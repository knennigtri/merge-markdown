const packageInfo = require("../package.json");
const manifestUtil = require("./manifest.js");
const merge = require("./merge.js");
const presentation = require("./presentation.js");
const dockerMerger = require("./docker.js");
const path = require("path");
const fs = require("fs");
const minimist = require("minimist");
const args = minimist(process.argv.slice(2));
//https://www.npmjs.com/package/debug
//Mac: DEBUG=* merge-markdown....
//WIN: set DEBUG=* & merge-markdown....
const debug = require("debug");
const debugArgs = debug("args");
const debugCLI = debug("cli");
const debbugOptions = {
  ...{
    "*": "Output all debugging messages",
    "args": "See CLI argument messages",
    "cli": "Validate CLI logic"
  },
  ...manifestUtil.debbugOptions,
  ...merge.debbugOptions,
  ...presentation.debbugOptions,
  ...dockerMerger.debbugOptions
};

function run() {
  const argsHelp = args.h || args.help;
  const argsVersion = args.v || args.version;
  const argsDebug = args.d || args.debug;
  const argsManifest = args.m || args.manifest;
  const argsQA = args.qa;
  const argsSkipLinkcheck = args.skipLinkcheck;
  const argsCreate = args.c || args.create;
  const argsMaintainAssetPaths = args.maintainAssetPaths;
  const argsGetDockerFiles = args.getDockerFiles;
  const argsUseDocker = args.docker || args.Docker;
  const argsFullProject = args.fullProject || args.fullproject || args.FullProject;
  const argsPDF = args.pdf || args.PDF;
  const argsHTML = args.html || args.HTML;
  const argsWORD = args.word || args.WORD;

  debugArgs(JSON.stringify(args, null, 2));

  // Show CLI help
  if (argsHelp) {
    const helpType = argsHelp === true ? "default" : argsHelp.toLowerCase();
    if (HELP[helpType]) console.log(HELP[helpType]);
    else console.log(HELP.default);
    return;
  }
  if (argsVersion) {
    console.log(packageInfo.version);
    return;
  }
  if (argsDebug) {
    console.log("[Mac] $ DEBUG=<option> " + cliName + " -m <file>");
    console.log("[Win] $ set DEBUG=<option> & " + cliName + " -m <file>");
    console.log("Options: " + JSON.stringify(debbugOptions, null, 2));
    return;
  }
  if (argsQA) console.log("QA mode");
  if (argsSkipLinkcheck) console.log("noLinkcheck mode");
  if (argsMaintainAssetPaths) console.log("maintainAssetPaths mode");

  if (argsCreate) {
    if(argsUseDocker) console.log("Docker cannot be used with --Create mode");
    var inputFilesPath = ".";
    if (typeof argsCreate === "string") {
      inputFilesPath = argsCreate;
    }
    manifestUtil.createManifestFile(inputFilesPath, argsFullProject);
    if(argsFullProject){
      const themeSourcePath = path.join(__dirname, "theme");
      debugCLI("Theme folder source: " + themeSourcePath);
      const themeDestPath = path.join(process.cwd(), "theme");
      fs.cpSync(themeSourcePath, themeDestPath, {recursive: true});
      debugCLI("Theme folder copied to: " + themeDestPath);
      const quickstartPath = path.join(__dirname, "quickstart.md");
      fs.cpSync(quickstartPath, path.join(process.cwd(), "quickstart.md"));
      debugCLI("Quickstart file copied to: " + path.join(process.cwd(), "quickstart.md"));  
    }
    return;
  }

  if(argsGetDockerFiles) {
    downloadDockerFiles();
    return;
  }

  //Require -m
  //If file, expect a manifest file, otherwise look for default file in given directory
  var manifestFilePath;
  // if (argsManifest && argsManifest[0] != undefined && argsManifest[0] != "") {
  try {
    if (argsManifest && typeof argsManifest === "string") {
      manifestFilePath = manifestUtil.getFile(argsManifest);
    } else { //if there is no -m check for a default manifest file
      manifestFilePath = manifestUtil.getFile("./");
    }
  } catch (err) {
    console.error(err);
    console.log(HELP);
  }
  if (manifestFilePath == undefined || manifestFilePath == "") {
    console.log("No manifest found. Consider auto-creating with -c or specify a manifest with -m");
    console.log(HELP.default);
    return;
  }

  if (argsUseDocker) {
    console.log("[Docker Mode] Building merge-markdown in a container.");
    var manifestDir = path.parse(manifestFilePath).dir;
    dockerMerger.runMergeMarkdownInDocker(manifestFilePath, process.argv.slice(2).join(" "));
    return;
  }

  debugCLI("manifest found at: " + manifestFilePath);
  console.log("Using: " + manifestFilePath);
  try {
    merge.start(manifestFilePath, argsQA, argsSkipLinkcheck, argsMaintainAssetPaths)
      .then(resultMarkdownFile => {
        //Add presentation
        var outputFormat = "";
        if (argsWORD) outputFormat = presentation.OUTPUT_FORMAT.word;
        if (argsHTML) outputFormat = presentation.OUTPUT_FORMAT.html;
        if (argsPDF) outputFormat = presentation.OUTPUT_FORMAT.pdf;
        return presentation.build(resultMarkdownFile, outputFormat, manifestFilePath);
      })
      .then(resultFile => {
        console.log(resultFile + " created.");
      })
      .catch((error) => {
        console.error(`Error creating file: ${error}`);
      });
  } catch (err) {
    console.error(err);
  }
}

function downloadDockerFiles(manifestPath){
  var downloadPath = manifestPath || "./";
  console.log("[Docker Mode] Downloading docker files...");
  const dockerFileNames = ["docker-compose.yml", "Dockerfile"];
  dockerFileNames.forEach((fileName) => {
    const sourcePath = path.join(__dirname, "../docker/", fileName);
    const destinationPath = path.join(downloadPath, fileName);

    // Copy the Docker file
    fs.copyFileSync(sourcePath, destinationPath);
    console.log("  Copied " + fileName + " to " + path.resolve(destinationPath));
  });
}

const cliName = packageInfo.name.replace("@knennigtri/", "");
const HELP = {
  default:
`Usage: merge-markdown [ARGS]
Arguments:
  -m, --manifest <manifestFile>            Path to input folder, yaml, or json manifest
  -v, --version                            Displays version of this package
  -c, --create <path>                      auto-creates ./manifest.yml with input files from <path>
  --fullProject                            Add to -c to include a basic theme, frontmatter, and npm scripts
  --docker                                 Run merge-markdown commands in docker
  --getDockerFiles                         Downloads the Docker files to your local project
  --qa                                     QA mode.
  --skipLinkcheck                          Skips linkchecking
  --maintainAssetPaths                     Retains original asset paths
  --pdf                                    Output to PDF. Must have Pandoc and wkhtmltopdf installed!
  --html --word                            Output to HTML or Word. Must have Pandoc installed!
  -h, --help                               Displays this screen
  -h manifest | options |
    outputOptions | qa | docker            See examples
  -d, --debug                              See debug Options
Default is ${manifestUtil.DEF_MANIFEST_NAME}[${manifestUtil.DEF_MANIFEST_EXTS.join("|")}] unless specified in -m.

Download Docker: https://docs.docker.com/get-docker/
`,
  manifest:
`Example yaml in a manifest file:
  input:
    global-frontmatter.md: {noYAML: false, doctoc: false}
    module1Folder/file1.md: {fileOptions}
    module2Folder/file2.md: {replace: {key:value}}
  noYAML: true
  doctoc: true
  output: 
    name: merged/myOutput.md
    {outputOptions}
  qa: {exclude: regex}
  {projectOptions}

Also, consider auto creating a manifest for your project:

$ merge-markdown --create /path/to/project --fullProject
`
  ,
  options:
`fileOptions are applied first and then projectOptions second.
Supported key/value pairs for {options}:
  noYAML: true|false                 Optionlly removes YAML. Default=false
  doctoc: true|false|"TOC title"     doctoc arguments. See https://www.npmjs.com/package/doctoc
      option: <value>
  replace:                           Searches for key and replaces with value
      key: value
      <!--{key}-->: value              Example key for a useful identifier
      *: "stringVal"                   Regular expressions are allowed
`,
  outputOptions:
`Supported key/value pairs for {outputOptions}:
  doctoc: true|false|"TOC title"            doctoc arguments. See https://www.npmjs.com/package/doctoc
      option: <value>
  pandoc:                                   pandoc arguments added to <value>. See https://pandoc.org/MANUAL.html#options
      key1: "-c mystyle.css"
      key2: "--template mytemplate.html"
  wkhtmltopdf:                              wkhtmltopdf options. See https://www.npmjs.com/package/wkhtmltopdf#options
      pageSize: Letter
      footerLine: true
`,
  qa:
`QA mode can optionally exclude files from the output.
Example: exclude all filenames with "frontmatter" by default
  qa: {exclude: "(frontmatter|preamble)"}
  `,
  docker:
`REQUIRED: Download Docker: https://docs.docker.com/get-docker/

  1. Start Docker
  2. Run:
    merge-markdown -m manifest.yml --docker

  Alternatively you can download the docker files directly:
    merge-markdown --getDockerFiles
    `
};

exports.run = run;