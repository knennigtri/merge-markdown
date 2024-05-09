const Docker = require('dockerode');
const fs = require('fs');
const path = require("path");
const tar = require('tar');
const packageInfo = require("./package.json");
const manifestUtil = require("./manifest.js");
const debug = require("debug");
const { Console } = require('console');
var debugDocker = debug("docker");
exports.debbugOptions = {
    docker: ""
};

const docker = new Docker();
const IMAGE_NAME = "node";
const IMAGE_TAG = "mm-beta";// + packageInfo.version; //TODO
const OUTPUT_LOGFILE = 'docker_build_output.log';
const CONTAINER_NAME = "mergeMarkdown";
const WORKING_DIR = "/home/runner/workspace/cli";
const TAR_NAME = "archive.tar.gz";

async function runMergeMarkdownInDocker(manifestFilePath, mergeMarkdownArgs) {
    debugDocker(`manifestFilePath: ${manifestFilePath}`);
    const manifest = manifestUtil.getManifestObj(manifestFilePath, false);
    const outputPath = path.parse(manifest.output.name).dir;
    debugDocker(`outputPath: ${outputPath}`)
    const manifestPath = path.parse(manifestFilePath).dir || "./";;
    debugDocker(`manifestPath: ${manifestPath}`)


    try {
        const imageExists = await dockerImageExists();
        if (!imageExists) {
            debugDocker('Image DNE..');
            return;
        }
        console.log("--------Docker Container START--------")
        getContainer()
            .then(container => {
                return container.inspect()
                    .then(info => {
                        if (info.State.Running == true) return container;
                        else return startContainer(container)
                    });
            })
            .then(resultContainer => {
                console.log("Copying this project to the docker container.")
                return createTarArchive(manifestPath, TAR_NAME)
                    .then(() => {
                        console.log('Tar archive created successfully');
                        return copyIntoContainer(resultContainer.id, TAR_NAME, WORKING_DIR);
                    })

            })
            .then(resultContainerID => {
                console.log("Extracting files into the container.");
                var extractCommand = `tar xzf ${WORKING_DIR}/${TAR_NAME} -C ${WORKING_DIR}`
                debugDocker(extractCommand);
                return execContainer(resultContainerID, extractCommand);
            })
            .then(resultContainerID => {
                debugDocker(`Running container is ${resultContainerID}`);
                var mergeMarkdown = `merge-markdown ${mergeMarkdownArgs}`;
                mergeMarkdown = mergeMarkdown.replace(/-m \S+\/\S+\/\S+\//, "-m ");
                mergeMarkdown = mergeMarkdown.replace("--docker", "");
                const commands = [`cd ${WORKING_DIR}`, mergeMarkdown].join(' && ');
                const cmd = ['/bin/sh', '-c', commands];
                debugDocker(cmd)
                debugDocker("Merging in Docker")
                return execContainer(resultContainerID, cmd, true);

            })
            .then(resultContainerID => {
                debugDocker("Downloading locally")
                return downloadFromContainer(resultContainerID, path.join(WORKING_DIR, outputPath));
            })
            .then(resultContainerID => {
                if (!debug.enabled("docker")) {
                    const fileToDel = path.join("./", TAR_NAME);
                    fs.unlink(fileToDel, (err) => {
                        if (err) {
                            console.error(`Could not delete ${fileToDel}`);
                        }
                    });
                }

                console.log("--------Docker Container END--------")
            });

    } catch (err) {
        console.error('Error getting or creating container:', err);
        throw err;
    }
}

function startContainer(container) {
    return new Promise((resolve, reject) => {
        debugDocker(`Starting container: ${container.id}`)
        container.start((err, data) => {
            if (err) {
                if (err.statusCode = 304) {
                    debugDocker("304. Container already running.")
                    resolve(container);
                } else {
                    console.error('Error starting container:', err);
                    reject(err);
                }
            } else {
                debugDocker(`Container started successfully`);
                resolve(container);
            }
        });
    });
}

function getContainer(containerName) {
    var name = containerName || CONTAINER_NAME;
    debugDocker(`Getting containter: ${name}`);
    return new Promise((resolve, reject) => {
        docker.getContainer(name).inspect((err, data) => {
            if (err) {
                if (err.statusCode = 404) {
                    debugDocker("404. Container doesn't exist. Creating...")
                    resolve(createContainer());
                } else reject(err);
            } else {
                debugDocker(`Found container ${name} with ID: ${data.Id}`)
                resolve(docker.getContainer(data.Id)); //returns a container
            }
        });
    });
}

// Function to create a container based on an existing image
function createContainer(containerName, imageName) {
    var name = containerName || CONTAINER_NAME;
    var img = imageName || `${IMAGE_NAME}:${IMAGE_TAG}`;
    debugDocker(`Creating container ${name} from image ${img}`);
    return new Promise((resolve, reject) => {
        docker.createContainer({
            Image: img,
            Tty: true,
            name: name
        }, (err, container) => {
            if (err) reject(err); // Failed to create container
            debugDocker(`Container created: ${container.id}`)
            resolve(startContainer(container));
        });
    });
}

async function execContainer(containerId, command, attachStd) {
    const execOptions = {
        Cmd: typeof command === 'string' ? command.split(' ') : Array.isArray(command) ? command : [],
        AttachStdout: attachStd,
        AttachStderr: attachStd,
    };

    const container = docker.getContainer(containerId);

    return new Promise((resolve, reject) => {
        container.exec(execOptions, function (err, exec) {
            const dockerConsole = "";
            if (err) {
                console.error('Error creating exec instance:', err);
                reject(err);
            } else {
                exec.start(function (err, stream) {
                    if (err) {
                        console.error('Error starting exec instance:', err);
                        reject(err);
                    } else {
                        stream.on('data', function (chunk) {
                            console.log(dockerConsole + chunk.toString());
                        });
                        exec.inspect(function (err, data) {
                            if (err) {
                                console.error('Error inspecting exec instance:', err);
                            } else {
                                console.log(dockerConsole + 'Running: ', data.ProcessConfig.entrypoint);
                            }
                        });
                        stream.on('end', function () {
                            resolve(containerId);
                        });
                    }
                });
            }
        });
    });
}

function dockerImageExists() {
    return new Promise((resolve, reject) => {
        docker.listImages({ filters: { reference: [`${IMAGE_NAME}:${IMAGE_TAG}`] } }, (err, images) => {
            if (err) {
                reject(err);
            }
            if (images.length > 0) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

//TODO fix build Image
function buildDockerImage(contextPath) {
    const imageName = `${IMAGE_NAME}:${IMAGE_TAG}`;
    const buildOptions = {
        context: path.resolve(contextPath),
        src: ['.'],
        dockerfile: 'Dockerfile',
        t: imageName
    };
    return new Promise((resolve, reject) => {
        debugDocker(buildOptions)
        const outputLogStream = fs.createWriteStream(OUTPUT_LOGFILE);
        const stream = docker.buildImage(buildOptions, (err, stream) => {
            if (err) {
                reject(err);
            }
            docker.modem.followProgress(stream, onFinished, onProgress);

            function onProgress(event) {
                // const eventData = JSON.parse(event.stream.toString());
                outputLogStream.write(event.stream.toString());
                if (debug.enabled("docker")) {
                    console.log(event);
                }
            }
            function onFinished(err, output) {
                if (err) {
                    console.error('Error building Docker image:', err);
                } else {
                    console.log(`Docker image built successfully: ${IMAGE_NAME}:${IMAGE_TAG}`);
                    resolve(`${IMAGE_NAME}:${IMAGE_TAG}`);
                }
            }
        });
    });
}

function copyIntoContainer(containerId, tarFilePath, destDir) {
    debugDocker(`Copying ${tarFilePath} to ${destDir}`)
    return new Promise((resolve, reject) => {
        const container = docker.getContainer(containerId);

        // Create a read stream from the tar archive
        const tarStream = fs.createReadStream(tarFilePath);

        // Copy the tar archive into the container
        container.putArchive(tarStream, { path: destDir }, (err, res) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(containerId);
        });
    });
}

/* Takes the sourceDir and compresses it into a tar at tafFilePath */
function createTarArchive(sourceDir, tarFilePath) {
    debugDocker(`${sourceDir} to tarball ${tarFilePath}`)
    return new Promise((resolve, reject) => {
        const tarStream = tar.c({
            gzip: true,
            cwd: sourceDir // Change to the source directory
        }, ['.']);
        const fileStream = fs.createWriteStream(tarFilePath);
        tarStream.pipe(fileStream);
        tarStream.on('end', () => {
            resolve();
        });
        tarStream.on('error', (err) => {
            reject(err);
        });
        fileStream.on('error', (err) => {
            reject(err);
        });
    });
}

/* Downloads the srcPath in the containerId to the local destPath */
async function downloadFromContainer(containerId, srcPath, destPath) {
    const stream = await docker.getContainer(containerId).getArchive({ path: srcPath });
    if (!destPath) destPath = "./";
    stream.pipe(tar.extract({ cwd: destPath }));
    return new Promise((resolve, reject) => {
        stream.on('end', () => {
            console.log(`Output ${srcPath} downloaded to ${path.join(destPath,path.basename(srcPath))}`);
            resolve(containerId);
        });
        stream.on('error', (err) => {
            reject(err);
        });
    });
}

exports.runMergeMarkdownInDocker = runMergeMarkdownInDocker;