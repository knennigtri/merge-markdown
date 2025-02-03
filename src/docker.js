const Docker = require("dockerode");
const fs = require("fs");
const path = require("path");
const tar = require("tar");
const manifestUtil = require("./manifest.js");
const debug = require("debug");
const { exec } = require("child_process");
var debugDocker = debug("docker");
exports.debbugOptions = {
  docker: ""
};

const docker = new Docker();
const IMAGE_NAME = "node";
const IMAGE_TAG = "mergemarkdown";
const CONTAINER_NAME = "mergemarkdown";
const WORKING_DIR = "/home/runner/workspace/cli";
const TAR_NAME = "archive.tar.gz";
const EXCLUDE_PATHS = [
  /.*\/node-modules\/.*/,
  /.*\/merged\/.*/,
  /.*\/target\/.*/,
];

async function runMergeMarkdownInDocker(manifestFilePath, mergeMarkdownArgs) {
  debugDocker(`manifestFilePath: ${manifestFilePath}`);
  const manifest = manifestUtil.getManifestObj(manifestFilePath, false);
  const outputPath = path.parse(manifest.output.name).dir;
  debugDocker(`outputPath: ${outputPath}`);
  const manifestPath = path.parse(manifestFilePath).dir || "./";
  debugDocker(`manifestPath: ${manifestPath}`);

  const excludePaths = [
    ...(EXCLUDE_PATHS || []), // Add EXCLUDE_PATHS if it exists
    ...(manifest.docker?.excludePaths || []) // Add manifest.docker.excludePaths if it exists
  ];

  
  try {
    const dockerRunning = await isDockerRunning();
    if(!dockerRunning){
      console.error("Docker is not running. Start the Docker engine and retry.");
      return;
    }
    const imageExists = await dockerImageExists(`${IMAGE_NAME}:${IMAGE_TAG}`);
    if (!imageExists) {
      console.log("Docker Image DNE. Creating...");

      var command = "docker compose -f docker-compose.yml up -d --build";
      console.log(command);
      await runExecCommands(command, manifestPath)
        .then(output => {
          console.log("Success.", output);
        })
        .catch(error => {
          console.error("Error executing:", error);
        });
    }
    console.log("--------Docker Container START--------");
    getContainer()
      .then(container => {
        return container.inspect()
          .then(info => {
            if (info.State.Running == true) return container;
            else return startContainer(container);
          });
      })
      .then(resultContainer => {
        console.log("Cleaning the docker working directory.");
        const command = `rm -rf ${WORKING_DIR}`;
        debugDocker(command);
        return execContainer(resultContainer, command);
      })
      .then(resultContainer => {
        // Recreate the working directory
        const command = `mkdir -p ${WORKING_DIR}`;
        debugDocker(command);
        return execContainer(resultContainer, command);
      })
      .then(resultContainer => {
        console.log("Copying this project to the docker container.");
        return createTarArchive(manifestPath, TAR_NAME, excludePaths)
          .then(() => {
            console.log("Tar archive created successfully");
            return copyIntoContainer(resultContainer, TAR_NAME, WORKING_DIR);
          });
      })
      .then(resultContainer => {
        console.log("Extracting files into the container.");
        var extractCommand = `tar xzf ${WORKING_DIR}/${TAR_NAME} -C ${WORKING_DIR}`;
        debugDocker(extractCommand);
        return execContainer(resultContainer, extractCommand);
      })
      .then(resultContainer => {
        debugDocker(`Running container is ${resultContainer.id}`);
        var mergeMarkdown = buildMergeMarkdownCommand(mergeMarkdownArgs);
        const commands = [`cd ${WORKING_DIR}`, mergeMarkdown].join(" && ");
        const cmd = ["/bin/sh", "-c", commands];
        debugDocker(cmd);
        debugDocker("Merging in Docker");
        return execContainer(resultContainer, cmd, true);

      })
      .then(resultContainer => {
        debugDocker("Downloading locally");
        return downloadFromContainer(resultContainer, path.join(WORKING_DIR, outputPath));
      })
      .then(() => {
        if (!debug.enabled("docker")) {
          const fileToDel = path.join("./", TAR_NAME);
          fs.unlink(fileToDel, (err) => {
            if (err) {
              console.error(`Could not delete ${fileToDel}`);
            }
          });
        }

        console.log("--------Docker Container END--------");
      });

  } catch (err) {
    console.error("Error getting or creating container:", err);
    throw err;
  }
}

/* Starts a docker container or returns the running container */
function startContainer(container) {
  return new Promise((resolve, reject) => {
    debugDocker(`Starting container: ${container.id}`);
    container.start((err) => {
      if (err) {
        if (err.statusCode === 304) {
          debugDocker("304. Container already running.");
          resolve(container);
        } else {
          console.error("Error starting container:", err);
          reject(err);
        }
      } else {
        debugDocker("Container started successfully");
        resolve(container);
      }
    });
  });
}

/* Gets the running container or starts and returns it */
function getContainer(containerName) {
  var name = containerName || CONTAINER_NAME;
  debugDocker(`Getting containter: ${name}`);
  return new Promise((resolve, reject) => {
    docker.getContainer(name).inspect((err, data) => {
      if (err) {
        if (err.statusCode === 404) {
          debugDocker("404. Container doesn't exist. Creating...");
          resolve(createContainer());
        } else reject(err);
      } else {
        debugDocker(`Found container ${name} with ID: ${data.Id}`);
        resolve(docker.getContainer(data.Id)); //returns a container
      }
    });
  });
}

/* Function to create a container based on an existing image */
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
      debugDocker(`Container created: ${container.id}`);
      resolve(startContainer(container));
    });
  });
}

/* execute commands within the running container */
async function execContainer(container, command, attachStd) {
  const execOptions = {
    Cmd: typeof command === "string" ? command.split(" ") : Array.isArray(command) ? command : [],
    AttachStdout: attachStd,
    AttachStderr: attachStd,
  };

  return new Promise((resolve, reject) => {
    container.exec(execOptions, function (err, exec) {
      console.log("Executing command: ", execOptions.Cmd.join(" "));
      const dockerConsole = "  ";
      let finalOutput = "";
      if (err) {
        console.error("Error creating exec instance:", err);
        reject(err);
      } else {
        exec.start(function (err, stream) {
          if (err) {
            console.error("Error starting exec instance:", err);
            reject(err);
          } else {
            stream.on("data", function (chunk) {
              finalOutput = finalOutput + dockerConsole + chunk;
            });
            exec.inspect(function (err, data) {
              if (err) {
                console.error("Error inspecting exec instance:", err);
              } else {
                console.log(dockerConsole + "Running: ", data.ProcessConfig.entrypoint);
              }
            });
            stream.on("end", function () {
              console.log(finalOutput);
              resolve(container);
            });
          }
        });
      }
    });
  });
}

function dockerImageExists(imageName) {
  var img = imageName || `${IMAGE_NAME}:${IMAGE_TAG}`;
  return new Promise((resolve, reject) => {
    docker.listImages({ filters: { reference: [img] } }, (err, images) => {
      if (images.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

function isDockerRunning() {
  return new Promise((resolve, reject) => {
    docker.ping((err) => {
      if (err) {
        resolve(false); // Docker is not running or not accessible
      } else {
        resolve(true); // Docker is running
      }
    });
  });
}

/* Run command line arguments with exec */
function runExecCommands(command, cwd) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        reject(stderr);
        return;
      }
      resolve(stdout);
    });
  });
}

/* Copy the local tarFilePath into the destDir in the container */
function copyIntoContainer(container, tarFilePath, destDir) {
  debugDocker(`Copying ${tarFilePath} to ${destDir}`);
  return new Promise((resolve, reject) => {

    const tarStream = fs.createReadStream(tarFilePath);
    container.putArchive(tarStream, { path: destDir }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(container);
    });
  });
}

/* Takes the sourceDir and compresses it into a tar at tarFilePath, excluding specified paths using regex */
function createTarArchive(sourceDir, tarFilePath, excludedPaths = []) {
  debugDocker(`${sourceDir} to tarball ${tarFilePath}`);
  
  return new Promise((resolve, reject) => {
    const tarStream = tar.c({
      gzip: true,
      cwd: sourceDir,
      filter: (filePath) => {
        // Get the relative path of the file from the sourceDir
        const relativePath = path.relative(sourceDir, filePath);
        
        // Check if any of the excludedPaths matches the relativePath using regex
        return !excludedPaths.some(excludedPath => {
          const regex = typeof excludedPath === "string" ? new RegExp(excludedPath) : excludedPath;
          // console.log("File ignored: " + regex);
          return regex.test(relativePath);
        });
      }
    }, ["."]);

    const fileStream = fs.createWriteStream(tarFilePath);

    tarStream.pipe(fileStream);
    
    tarStream.on("end", () => {
      resolve();
    });
    
    tarStream.on("error", (err) => {
      reject(err);
    });
    
    fileStream.on("error", (err) => {
      reject(err);
    });
  });
}

/* Downloads the srcPath in the container to the local destPath */
async function downloadFromContainer(container, srcPath, destPath) {
  const stream = await container.getArchive({ path: srcPath });
  if (!destPath) destPath = "./";
  stream.pipe(tar.extract({ cwd: destPath }));
  return new Promise((resolve, reject) => {
    stream.on("end", () => {
      console.log(`Output ${srcPath.replace(WORKING_DIR, ".")} downloaded to ${path.join(path.resolve(destPath), path.basename(srcPath))}`);
      resolve(container);
    });
    stream.on("error", (err) => {
      reject(err);
    });
  });
}

function buildMergeMarkdownCommand(origArgs) {
  let argsArray = origArgs.split(" ");
  const mIndex = argsArray.indexOf("-m");

  if (mIndex !== -1 && mIndex + 1 < argsArray.length) {
    let mValue = argsArray[mIndex + 1];
    let fileName = path.basename(mValue); // Extract only the filename

    argsArray[mIndex + 1] = fileName; // Replace the original path with filename
  }

  let mmCommand = `merge-markdown ${argsArray.join(" ")}`;
  mmCommand = mmCommand.replace("--docker", "");

  return mmCommand;
}

exports.runMergeMarkdownInDocker = runMergeMarkdownInDocker;