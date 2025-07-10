"use strict";
var fs = require("fs");
var path = require("path");
var yaml = require("js-yaml");
const { spawn } = require("child_process");
var debug = require("debug")("manifest");
var debugDeprecation = require("debug")("manifest:deprecation");
var debugJson = require("debug")("manifest:json");

exports.debbugOptions = {
  "manifest": "",
  "manifest:deprecation": "",
  "manifest:json": "",
};

const DEFAULT_MANIFEST = {
  NAME: "manifest",
  EXT_TYPES: ["yml", "yaml", "json"],
  get EXTS() { return this.EXT_TYPES.map(ext => `.${ext}`); },
  get FILE() { return `${this.NAME}${this.EXTS[0]}`; },
  get FILE_TYPES() { return `${this.NAME}[${this.EXTS.join("|")}]`; }
};

const manifestWriteDir = process.cwd(); // When using -c relative/path/to/markdown/files, the manifest will where the command is run

/**
 * Creates a valid manifest JSON based on input (or no input)
 * DEBUG=manifest:json
 */
exports.getManifestObj = function (inputManifestFile, qaMode) {
  var fileType = path.extname(inputManifestFile).toLowerCase();
  if (!DEFAULT_MANIFEST.EXTS.includes(fileType)) {
    console.log("Manifest extension must be: [" + DEFAULT_MANIFEST.EXTS.join("|") + "]");
    return;
  }
  debug("Found manifest to use: " + inputManifestFile);
  var fileContents = fs.readFileSync(inputManifestFile, "utf8");
  var jsonObj = "";
  try {
    //Attempt to read the YAML and output JSON
    var data = yaml.loadAll(fileContents, "json");
    var yamlContents = JSON.stringify(data[0], null, 2);
    jsonObj = JSON.parse(yamlContents);
  } catch {
    debugJson("Could not read YAML, attemping JSON");
    try {
      //Attempt to read JSON
      jsonObj = JSON.parse(fileContents);
    } catch (e) {
      console.log("Manifest file does not contain valid YAML or JSON content.");
      throw e;
    }
  }

  // If the manifest doesn"t have an output, generate the output name based on the manifest directory
  if (!jsonObj.output || !jsonObj.output.name) throw new Error("Manifest is missing output.name. Consider auto-creating an initial manifest");
  // jsonObj = fixDeprecatedEntry(jsonObj);
  if (jsonObj.output.name.split(".").pop() != "md") throw new Error("output.name needs to be a .md file but found: " + jsonObj.output.name);
  if (!jsonObj.input) throw new Error("Manifest is missing input. Consider auto-creating an initial manifest");

  jsonObj = fixDeprecatedEntry(jsonObj);

  if (qaMode) {
    if (!jsonObj.qa || !jsonObj.qa.exclude) {
      console.log("No exclude patterns given for QA. Using default `frontmatter` for exclusion.");
      jsonObj.qa = { "exclude": "frontmatter" };
    }
  }
  return jsonObj;
};

/**
 * 
 * @param {*} inputManifestFile 
 * @param {*} qaMode 
 * @returns 
 */

/** TODO implement this method to guarantee minimum fields are set or FAIL
 * !m.input - fail
 * At least one m.input[key] - fail
 * !m.output - create default
 * !m.output.name - create default
 * !m.output.pandoc - create default
 * !m.output.wkhtmltopdf - create default
 * !m.qa.exclude - create default
 */
exports.getJSON_withABSPaths = function (inputManifestFile, qaMode) {
  const manifestObj = exports.getManifestObj(inputManifestFile, qaMode); 
  const baseDir = path.dirname(inputManifestFile);

  // Update input paths to absolute paths
  if (manifestObj.input) {
    // manifest.input[key]
    let inputObjABS = {};
    for (const keyPath in manifestObj.input) {
      let absPath = path.resolve(baseDir, keyPath);
      inputObjABS = {
        ...inputObjABS,
        [absPath]: { ...manifestObj.input[keyPath] }
      };
    }
    debugJson(`manifest.input (ABS): ${JSON.stringify(inputObjABS, null, 2)}`);
    manifestObj.input = inputObjABS;
  }

  // Update output paths to absolute paths
  if (manifestObj.output) {
    for (const keyPath in manifestObj.output) {
      // manifest.output.name
      if (keyPath === "name") {
        manifestObj.output.name = path.resolve(baseDir, manifestObj.output.name);
        debugJson(`manifestObj.output.name (ABS): ${manifestObj.output.name}`);
      }

      // manifest.output.pandoc.css
      // manifest.output.pandoc.latexTemplate
      // manifest.output.pandoc.referenceDoc
      if (keyPath === "pandoc") {
        let p = manifestObj.output.pandoc;
        if (p.css) p.css = resolveCommandPath(baseDir, p.css);
        if (p.latexTemplate) p.latexTemplate = resolveCommandPath(baseDir, p.latexTemplate);
        if (p.referenceDoc) p.referenceDoc = resolveCommandPath(baseDir, p.referenceDoc);
        manifestObj.output.pandoc = p;
        debugJson(`manifest.output.pandoc (ABS): ${JSON.stringify(p, null, 2)}`);
      }
    }
  }
  return manifestObj;
};

// Function to parse command parameter and resolve file path
function resolveCommandPath(baseDir, commandString) {
  if (!commandString || typeof commandString !== "string") return commandString;

  // Split on spaces to separate flag from path
  const parts = commandString.trim().split(/\s+/);
  if (parts.length < 2) return commandString;

  // First part is the flag (e.g., '-c', '--template', '--reference-doc')
  const flag = parts[0];
  const fileRelPath = parts.slice(1).join(" ");
  const absPath = path.resolve(baseDir, fileRelPath); // Resolve the file path to absolute
  return `${flag} ${absPath}`;
}

/**
 * Method to organize the manifest for merge and presentation to 
 * allow for non-destructive updates to merge-markdown.
 * Important if users are coming from earlier versions of merge-markdown
 */
function fixDeprecatedEntry(manifestFix) {
  var updatesNeeded = "";
  //Fix output to allow for keys under the output
  if (typeof manifestFix.output === "string") {
    var name = manifestFix.output;
    delete manifestFix.output;
    manifestFix.output = {};
    manifestFix.output.name = name;
    updatesNeeded += "   manifest.output >> manifest.output.name.\n";
  }

  //Move all outputOptions under the output
  if (Object.prototype.hasOwnProperty.call(manifestFix, "mergedTOC")) {
    manifestFix.output.doctoc = manifestFix.mergedTOC;
    delete manifestFix.mergedTOC;
    updatesNeeded += "   manifest.mergedTOC >> manifest.output.doctoc.\n";
  }
  if (Object.prototype.hasOwnProperty.call(manifestFix, "pandoc")) {
    manifestFix.output.pandoc = manifestFix.pandoc;
    delete manifestFix.pandoc;
    updatesNeeded += "   manifest.pandoc >> manifest.output.pandoc.\n";
  }
  if (Object.prototype.hasOwnProperty.call(manifestFix, "wkhtmltopdf")) {
    manifestFix.output.wkhtmltopdf = manifestFix.wkhtmltopdf;
    delete manifestFix.wkhtmltopdf;
    updatesNeeded += "   manifest.wkhtmltopdf >> manifest.output.wkhtmltopdf.\n";
  }

  //Update all TOC and mergedTOC keys to doctoc
  if (Object.prototype.hasOwnProperty.call(manifestFix.output, "TOC")) {
    manifestFix.output.doctoc = manifestFix.output.TOC;
    delete manifestFix.output.TOC;
    updatesNeeded += "   manifest.output.TOC >> manifest.output.doctoc.\n";
  }
  if (Object.prototype.hasOwnProperty.call(manifestFix.output, "mergedTOC")) {
    manifestFix.output.doctoc = manifestFix.output.mergedTOC;
    delete manifestFix.output.mergedTOC;
    updatesNeeded += "   manifest.output.mergedTOC >> manifest.output.doctoc.\n";
  }
  if (Object.prototype.hasOwnProperty.call(manifestFix, "TOC")) {
    manifestFix.doctoc = manifestFix.TOC;
    delete manifestFix.TOC;
    updatesNeeded += "   manifest.TOC >> manifest.doctoc.\n";
  }
  if (Object.prototype.hasOwnProperty.call(manifestFix, "input")) {
    var update = false;
    for (var i in manifestFix.input) {
      if (Object.prototype.hasOwnProperty.call(manifestFix.input[i], "TOC")) {
        manifestFix.input[i].doctoc = manifestFix.input[i].TOC;
        delete manifestFix.input[i].TOC;
        update = true;
      }
    }
    if (update) updatesNeeded += "   manifest.input[item].TOC >> manifest.input[item].doctoc.\n";
  }

  //Display to the user which keys should be updated in their manifest
  if (updatesNeeded) {
    console.log("[WARNING] Below entries are old. Consider updating your manifest:");
    console.log(updatesNeeded);
  }
  debugDeprecation(JSON.stringify(manifestFix, null, 2));
  return manifestFix;
}

/**
 * Checks if a manifest file exists
 * @param {*} inputArg file/directory given in -m param
 * @returns valid manifest file or false
 */
exports.exists = function (inputArg) {
  try {
    var fsStat = fs.lstatSync(inputArg);
    if (fsStat.isFile()) { //Set if file is given
      const e = path.extname(inputArg).toLowerCase();
      if (DEFAULT_MANIFEST.EXTS.includes(e)) {
        debug(`Found Manifest: ${inputArg}`);
        return inputArg;
      } else {
        console.log(`Manifest file can only be [${DEFAULT_MANIFEST.EXTS.join("|")}]`);
        return false;
      }
    } else if (fsStat.isDirectory()) { //Search for default manifest if directory
      debug(`Searching for ${DEFAULT_MANIFEST.FILE_TYPES} in ${inputArg}`);
      const directory = inputArg;
      const possibleFileNames = DEFAULT_MANIFEST.EXTS.map(ext => `${DEFAULT_MANIFEST.NAME}${ext}`);
      //Look for a manifest file in the given directory
      for (const fileName of possibleFileNames) {
        const filePath = path.join(directory, fileName);
        var fileStat = fs.lstatSync(filePath);
        if (fileStat.isFile()) {
          debug(`Found Default Manifest: ${filePath}`);
          return filePath;
        }
      }
      console.log(`No default ${DEFAULT_MANIFEST.FILE_TYPES} file found in ${directory}`);
    }
  } catch (err) {
    console.log(`${inputArg} is not a valid file or directory`);
    return false;
  }
};

/**
* Autocreates a starter manifest file 
* @param {*} dir location of input files
* @param {*} fullProject boolean to add 'full project on create' paths
*/
exports.createManifestFile = function (dir, fullProject) {
  const jsonObject = {
    input: {},
    noYAML: true,
    doctoc: true,
    replace: {
      "<!--{timestamp}-->": "01/01/2024",
      "<!--{title}-->": "My Title",
      "<!--{author}-->": "Chuck Grant",
      "<!--{documentType}-->": "Instruction Manual",
      "### My h3 title": "#### My h4 title",
      "({#(.*?)})": ""
    },
    output: {
      "name": "target/mergedFile.md",
      "doctoc": true,
      "pandoc": {
        "css": "-c path/to/theme.css",
        "latexTemplate": "--template path/to/latex/template.html",
        "referenceDoc": "--reference-doc path/to/reference.docx"
      },
      "wkhtmltopdf": {
        "marginBottom": ".7in",
        "marginTop": "1in",
        "marginLeft": ".7in",
        "marginRight": ".7in",
        "pageSize": "Letter",
        "headerFontSize": 8,
        "headerSpacing": 5,
        "headerRight": "[section]",
        "footerLine": true,
        "footerFontSize": 8,
        "footerLeft": "[doctitle]",
        "footerCenter": "",
        "footerRight": "[page]",
      }
    },
    docker: {
      excludePaths: [
        "/target/",
        "/dist/"
      ]
    },
    qa: { exclude: "(frontmatter|preamble)" }
  };

  if (fullProject) {
    jsonObject.input["theme/frontmatter.md"] = { noYAML: false, doctoc: false };
    jsonObject.output.pandoc.css = "-c theme/theme.css";
    jsonObject.output.pandoc.latexTemplate = "--template theme/template.html";
    jsonObject.output.pandoc.referenceDoc = "--reference-doc theme/reference.docx";
  }

  var inputArr = findMarkdownFiles(dir);
  var counter = 0;
  inputArr.forEach(file => {
    var inputOptions = {
      replace: {
        "\\[#\\]": counter
      }
    };
    jsonObject.input[file] = inputOptions;
    counter++;
  });

  //Write YAML File
  const yamlString = yaml.dump(jsonObject);
  const manifestPath = path.join(manifestWriteDir, `${DEFAULT_MANIFEST.FILE}`);
  try {
    fs.writeFileSync(manifestPath, yamlString);
    console.log("YAML file successfully created: " + manifestPath);
  } catch (error) {
    console.error("Error writing: " + manifestPath, error);
  }

  // Write the package.json file if the fullProject flag is set
  if (fullProject) {
    writeNPMFile();
  }
};

/**
* Finds all markdown (.md) files within a directory
* @param {*} directoryPath path to search
* @returns array of .md paths
*/
function findMarkdownFiles(directoryPath) {
  let markdownFiles = [];
  // Synchronously read the contents of the directory
  const files = fs.readdirSync(directoryPath);
  // Iterate through each file in the directory
  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);
    // Check if the file is a directory
    if (stats.isDirectory()) {
      // Recursively search for .md files in the subdirectory
      markdownFiles = markdownFiles.concat(findMarkdownFiles(filePath));
    } else {
      if (path.extname(file).toLowerCase() === ".md") {
        markdownFiles.push(filePath);
      }
    }
  }
  return markdownFiles;
}

function writeNPMFile() {
  const packageJsonPath = path.join(process.cwd(), "package.json");

  // Check if package.json already exists
  if (fs.existsSync(packageJsonPath)) {
    console.log("package.json already exists, skipping npm init");
    return;
  }

  return new Promise((resolve, reject) => {
    console.log("Running npm init - please fill out your project details...");

    // Run npm init interactively
    const npmInit = spawn("npm", ["init"], {
      stdio: "inherit",
      shell: true
    });

    npmInit.on("close", (code) => {
      if (code === 0) {
        debug("package.json created successfully");

        // Now read and modify the package.json
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

          // Add your custom fields to package.json
          packageJson.scripts = {
            ...packageJson.scripts,
            "pre": "rimraf merged || rimraf target || true",
            "merge-markdown": "npm run pre && npm run mm:docker && npm run cleanup",
            "cleanup": "",
            "mm:docker": "merge-markdown -m manifest.yml --pdf --docker",
            "mm:html": "merge-markdown -m manifest.yml --html",
            "mm:word": "merge-markdown -m manifest.yml --word",
            "install:docker:mac": "brew install caskroom/cask/brew-cask; brew cask install docker",
            "install:docker:win": "powershell -Command \"Start-Process -Wait -FilePath 'winget' -ArgumentList 'install -e --id Docker.DockerDesktop'\"",
          };

          packageJson.dependencies = {
            ...packageJson.dependencies,
            "@knennigtri/merge-markdown": "*",
            "rimraf": "^5.0.0"
          };

          packageJson.devDependencies = {
            ...packageJson.devDependencies
          };

          packageJson.bugs = {
            "url": "https://github.com/knennigtri/merge-markdown/issues/new/choose"
          };

          // Write the modified package.json back
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
          console.log("package.json updated with merge-markdown configurations.");
          console.log("Run `npm install` to install the project dependencies to use the npm scripts.");
          console.log("It's highly recommended to install docker for optimal use: https://docs.docker.com/engine/install");
          console.log("Run `npm run merge-markdown` to build your project. (Requires docker)");

          resolve(packageJsonPath);
        } catch (error) {
          console.error("Error modifying package.json:", error);
          reject(error);
        }
      } else {
        console.error("npm init failed with code:", code);
        reject(new Error(`npm init failed with code: ${code}`));
      }
    });

    npmInit.on("error", (error) => {
      console.error("Error running npm init:", error);
      reject(error);
    });
  });
}

exports.DEFAULT_MANIFEST = DEFAULT_MANIFEST;