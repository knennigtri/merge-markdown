const packageInfo = require("../package.json");
const dockerode = require("dockerode");
const fs = require("fs");
const path = require("path");
const tar = require("tar");
const manifestUtil = require("./manifest.js");
const presentationUtil = require("./presentation.js");
const mergeUtil = require("./merge.js");
const { exec } = require("child_process");
const debug = require("debug");
const debugDocker = debug("docker");
const debugDockerPaths = debug("docker:paths");
exports.debbugOptions = {
  docker: "docker",
  dockerPaths: "docker:paths"
};

const docker = new dockerode();
const IMAGE_NAME = "node";
const IMAGE_TAG = "mergemarkdown";
const CONTAINER_NAME = "mergemarkdown";
const WORKING_DIR = "/home/runner/workspace/cli";
const TAR_NAME = "archive.tar.gz";
const EXCLUDE_PATHS = [
  /node_modules/,    // Matches any path containing 'node_modules'
  /quickstart.md/,
  /merged/,          // Matches any path containing 'merged'
  /target/,          // Matches any path containing 'target'
  ".git/",
  ".vscode/",
  "archive.tar.gz",

];

async function runMergeMarkdownInDocker(manifestFileStr, cmdArgs) {
  const manifest = manifestUtil.getJSON_withABSPaths(manifestFileStr);
  const manifestOutputName = manifest.output.name;
  const excludePaths = [
    ...EXCLUDE_PATHS,
    ...(Array.isArray(manifest.docker?.excludePaths) ? manifest.docker.excludePaths : [])
  ];
  debugDocker(`excludePaths:\n${excludePaths.map(regex => `  ${regex.toString()}`).join("\n")}`);

  // relDir given in -m dir/manifest.yml to help build docker upload/download paths
  const manifestRelDir = path.parse(manifestFileStr).dir || "./";
  debugDocker(`manifestDir: ${manifestRelDir}`);

  try {
    const dockerRunning = await isDockerRunning();
    if (!dockerRunning) {
      console.error("Docker is not running. Start the Docker engine and retry.");
      return;
    }
    const imageExists = await dockerImageExists(`${IMAGE_NAME}:${IMAGE_TAG}`);
    let needsRebuild = false;
    
    if (!imageExists) {
      console.log("Docker Image DNE. Creating...");
      needsRebuild = true;
    } else {
      // Check if existing image has compatible Node.js version
      const hasCompatibleNodeVersion = await checkDockerImageNodeVersion(`${IMAGE_NAME}:${IMAGE_TAG}`);
      if (!hasCompatibleNodeVersion) {
        console.log("Docker Image exists but has incompatible Node.js version. Rebuilding with Node.js 20+...");
        needsRebuild = true;
      } else {
        debugDocker("Docker Image exists and has compatible Node.js version");
      }
    }

    if (needsRebuild) {
      var command = `docker compose -f ${path.join(__dirname, '../docker/docker-compose.yml')} up -d --build`;
      console.log(command);
      await runExecCommands(command, manifestRelDir)
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
        const command = `rm -rf ${WORKING_DIR}/*`;
        debugDocker(command);
        return execContainer(resultContainer, command);
      })
      .then(resultContainer => {
        console.log("Copying this project to the docker container.");
        console.log(`Exclude Copying These Paths:\n${excludePaths.map(regex => `  ${regex.toString()}`).join("\n")}`);
        return createTarArchive("./", TAR_NAME, excludePaths)
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

        const npmModuleName = packageInfo.name.replace(/@[^/]+\//, "");
        let requestedCMD = `${npmModuleName} ${cmdArgs}`;
        requestedCMD = requestedCMD.replace("--docker", "");

        const commands = [`cd ${WORKING_DIR}`, requestedCMD].join(" && ");
        const dockerCMD = ["/bin/sh", "-c", commands];
        debugDocker(dockerCMD);
        debugDocker("Merging in Docker");
        return execContainer(resultContainer, dockerCMD, true);

      })
      .then(resultContainer => {
        debugDocker("Downloading locally");
        debugDockerPaths(`WORKING_DIR: ${WORKING_DIR}`);
        debugDockerPaths(`manifestOutputName: ${manifestOutputName}`);
        debugDockerPaths(`manifestRelDir: ${manifestRelDir}`);
        debugDockerPaths(`process.cwd(): ${process.cwd()}`); //ABS path where the npm command was executed

        const relManifestOutputName = path.relative(process.cwd(), manifestOutputName);
        const absManifestOutputName_inDocker = path.join(WORKING_DIR , relManifestOutputName);
        const absManifestOutputName_parsed = path.parse(absManifestOutputName_inDocker);
        const absManifestOutputName_name = absManifestOutputName_parsed.name; // Get the base filename without extension
        const absManifestOutputName_dir = absManifestOutputName_parsed.dir; // Get the docker directory of output
        debugDockerPaths(`Downloading merged Files from: ${absManifestOutputName_dir}`);

        const outputPaths = [
          absManifestOutputName_inDocker,
          ...Object.values(presentationUtil.EXTS).map(ext => path.join(absManifestOutputName_dir, `${absManifestOutputName_name}${ext}`)),
          ...Object.values(mergeUtil.EXTS).map(ext => path.join(absManifestOutputName_dir, `${absManifestOutputName_name}${ext}`)),
          path.join(absManifestOutputName_dir, "temp.html")
        ];
        debugDockerPaths(`Downloading files if they exist:\n${outputPaths.map(p => `  ${p}`).join("\n")}`);

        const destPath = path.parse(manifestOutputName).dir;
        debugDockerPaths(`Downloading to ${destPath}`);
         
        // Ensure clean destination directory - delete and recreate
        if (fs.existsSync(destPath)) {
          fs.rmSync(destPath, { recursive: true, force: true });
          debugDockerPaths(`Deleted existing directory: ${destPath}`);
        }
        fs.mkdirSync(destPath, { recursive: true });
        debugDockerPaths(`Created clean directory: ${destPath}`);
         
        return downloadFromContainer(resultContainer, outputPaths, destPath);
      })
      .then(() => {
        if (debug.enabled("docker")) {
          debugDocker(`Skipping ${TAR_NAME} file deletion in debug mode`);
        } else {
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

/* Check if the Docker image has a compatible Node.js version */
async function checkDockerImageNodeVersion(imageName) {
  var img = imageName || `${IMAGE_NAME}:${IMAGE_TAG}`;
  debugDocker(`Checking Node.js version in image: ${img}`);
  
  try {
    // Create a temporary container to check Node.js version
    const container = await docker.createContainer({
      Image: img,
      Cmd: ['node', '--version'],
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true
    });

    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    await container.start();
    await container.wait();
    await container.remove();

    // Extract version number (e.g., "v20.1.0" -> 20)
    const versionMatch = output.match(/v(\d+)\./);
    if (versionMatch) {
      const majorVersion = parseInt(versionMatch[1]);
      debugDocker(`Found Node.js version: ${majorVersion}`);
      
      // Require Node.js 20 or higher for proper Web API support
      return majorVersion >= 20;
    }
    
    debugDocker(`Could not parse Node.js version from: ${output}`);
    return false;
  } catch (error) {
    debugDocker(`Error checking Node.js version: ${error.message}`);
    // If we can't check the version, assume it's outdated and needs rebuild
    return false;
  }
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
    let includedCount = 0;
    
    const tarStream = tar.c({
      gzip: true,
      cwd: sourceDir,
      filter: (filePath) => {
        const relativePath = path.relative(sourceDir, filePath);
        
        // Normalize path separators to forward slashes for consistent regex matching
        const normalizedPath = relativePath.replace(/\\/g, "/");

        // Check if this path or any parent path should be excluded
        const shouldExclude = excludedPaths.some(excludedPath => {
          const regex = typeof excludedPath === "string" ? new RegExp(excludedPath) : excludedPath;

          // Check if the current path matches
          if (regex.test(normalizedPath)) {
            debugDockerPaths(`Excluding: ${normalizedPath} (matched: ${regex.toString()})`);
            return true;
          }

          // Check if this path is inside an excluded directory
          const pathParts = normalizedPath.split("/");
          for (let i = 0; i < pathParts.length; i++) {
            const partialPath = pathParts.slice(0, i + 1).join("/");
            if (regex.test(partialPath)) {
              debugDockerPaths(`Excluding: ${normalizedPath} (parent matched: ${regex.toString()})`);
              return true;
            }
          }

          return false;
        });

        if (!shouldExclude) {
          includedCount++;
          debugDockerPaths(`Including: ${normalizedPath}`);
        }
        
        return !shouldExclude;
      }
    }, ["."]);

    const fileStream = fs.createWriteStream(tarFilePath);

    tarStream.pipe(fileStream);

    tarStream.on("end", () => {
      debugDocker(`Archive created with ${includedCount} files`);
      if (includedCount === 0) {
        console.warn("Warning: No files were included in the archive. Check exclude patterns.");
      }
      resolve();
    });

    tarStream.on("error", (err) => {
      console.error("Error creating tar archive:", err);
      reject(err);
    });

    fileStream.on("error", (err) => {
      console.error("Error writing tar file:", err);
      reject(err);
    });
  });
}

/* Downloads the srcPath in the container to the local destPath */
async function downloadFromContainer(container, srcPaths, destPath) {
  if (!Array.isArray(srcPaths)) {
    srcPaths = [srcPaths];
  }

  if (!destPath) destPath = "./";

  // Ensure the destination directory exists
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }
  console.log(`Downloading files to ${destPath}`);

  const downloadPromises = srcPaths.map(async (srcPath) => {
    try {
      const stream = await container.getArchive({ path: srcPath });

      return new Promise((resolve, reject) => {
        stream.pipe(tar.extract({ cwd: destPath }));
        stream.on("end", () => {
          debugDocker(`Output ${srcPath.replace(WORKING_DIR, ".")} downloading..`);
          resolve();
        });
        stream.on("error", (err) => {
          reject(err);
        });
      });
    } catch (err) {
      debugDocker(`File ${srcPath} not found, skipping`);
      return null;
    }
  });

  await Promise.all(downloadPromises);
  return container;
}

exports.runMergeMarkdownInDocker = runMergeMarkdownInDocker;