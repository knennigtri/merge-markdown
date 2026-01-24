const packageInfo = require("../package.json");
const npmModuleName = packageInfo.name.replace(/@[^/]+\//, "");
const manifestUtil = require("./manifest.js");
const merge = require("./merge.js");
const presentation = require("./presentation.js");
const dockerMerger = require("./docker.js");
const assetCleaner = require("./asset-cleaner.js");
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
  ...dockerMerger.debbugOptions,
  "asset-cleaner": "Asset cleaning debug messages"
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
  const argsLang = args.lang;
  const argsCleanAssets = args["clean-assets"];
  const argsAssetsDir = args["assets-dir"];
  const argsFix = args.fix;
  const argsNoAssetPreview = args["no-asset-preview"];

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
    console.log(`[Mac] $ DEBUG=<option> ${npmModuleName} -m <file>`);
    console.log(`[Win] $ set DEBUG=<option> & ${npmModuleName} -m <file>`);
    console.log(`Options: ${JSON.stringify(debbugOptions, null, 2)}`);
    return;
  }
  // Show active modes
  const activeModes = [];
  if (argsQA) activeModes.push("QA");
  if (argsSkipLinkcheck) activeModes.push("Skip Linkcheck");
  if (argsMaintainAssetPaths) activeModes.push("Maintain Asset Paths");
  if (argsLang) activeModes.push("Language: " + argsLang);
  if (argsNoAssetPreview) activeModes.push("No Asset Preview");
  
  if (activeModes.length > 0) {
    console.log("⚙️  Modes: " + activeModes.join(", "));
  }

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

  // Handle asset cleaning command
  if (argsCleanAssets !== undefined) {
    runAssetCleaning(argsCleanAssets, argsAssetsDir, argsFix);
    return;
  }

  //Require -m
  //If file, expect a manifest file, otherwise look for default file in given directory
  var manifestFilePath;
  try {
    if (argsManifest && typeof argsManifest === "string") {
      manifestFilePath = manifestUtil.exists(argsManifest);
    } else { //if there is no -m check for a default manifest file
      manifestFilePath = manifestUtil.exists("./");
    }
  } catch (err) {
    console.error(err);
    console.log(HELP);
  }
  if (!manifestFilePath) {
    console.log("No manifest found. Consider auto-creating with -c or specify a manifest with -m \n");
    console.log(HELP.default);
    return;
  }

  if (argsUseDocker) {
    console.log(`[Docker Mode] Building ${npmModuleName} in a container.`);
    dockerMerger.runMergeMarkdownInDocker(manifestFilePath, process.argv.slice(2).join(" "));
    return;
  }

  debugCLI("manifest found at: " + manifestFilePath);
  const relativeManifest = path.relative(process.cwd(), manifestFilePath);
  console.log("📋 Manifest: " + relativeManifest);
  try {
    merge.start(manifestFilePath, argsQA, argsSkipLinkcheck, argsMaintainAssetPaths, argsLang, argsNoAssetPreview)
      .then(resultMarkdownFile => {
        //Add presentation
        var outputFormat = "";
        if (argsWORD) outputFormat = presentation.EXTS.docx;
        if (argsHTML) outputFormat = presentation.EXTS.html;
        if (argsPDF) outputFormat = presentation.EXTS.pdf;
        return presentation.build(resultMarkdownFile, outputFormat, manifestFilePath);
      })
      .then(resultFile => {
        const relativePath = path.relative(process.cwd(), resultFile);
        console.log("\n✅ Output: " + relativePath);
      })
      .catch((error) => {
        // Error details already logged by the respective functions
        // Just exit with error code
        process.exit(1);
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

function runAssetCleaning(targetDir, assetsDir, fixMode) {
  debugCLI("Running asset cleaning");
  
  // Determine target directory
  let cleanTargetDir;
  if (typeof targetDir === "string") {
    // User provided a specific directory
    cleanTargetDir = path.isAbsolute(targetDir) 
      ? targetDir 
      : path.join(process.cwd(), targetDir);
  } else {
    // No directory specified, use current working directory
    cleanTargetDir = process.cwd();
  }
  
  // Use provided assets directory name or default
  const assetsFolderName = assetsDir || "assets";
  const isFixMode = fixMode || false;
  
  debugCLI(`Target directory: ${cleanTargetDir}`);
  debugCLI(`Assets folder: ${assetsFolderName}`);
  debugCLI(`Fix mode: ${isFixMode}`);
  
  // Run the asset cleaning
  const result = assetCleaner.cleanAssets(cleanTargetDir, assetsFolderName, isFixMode, true);
  
  if (result.error) {
    console.error(`❌ Error: ${result.error}`);
    process.exit(1);
  }
}


const HELP = {
  default:
`Usage: ${npmModuleName} [ARGS]
Arguments:
  -m, --manifest <manifestFile>            Path to input folder, yaml, or json manifest
  -v, --version                            Displays version of this package
  -c, --create <path>                      auto-creates ./manifest.yml with input files from <path>
  --fullProject                            Add to -c to include a basic theme, frontmatter, and npm scripts
  --docker                                 Run ${npmModuleName} commands in docker
  --getDockerFiles                         Downloads the Docker files to your local project
  --qa                                     QA mode.
  --skipLinkcheck                          Skips linkchecking
  --maintainAssetPaths                     Retains original asset paths
  --lang <language>                        Language code for multilingual support (e.g., --lang=es)
  --clean-assets [directory]               Clean unused assets in specified directory (or current directory)
  --assets-dir <name>                      Name of assets folder (default: 'assets')
  --fix                                    Actually delete unused assets (default: preview mode)
  --no-asset-preview                       Disable asset preview during normal merge workflow
  --pdf                                    Output to PDF. Must have Pandoc and wkhtmltopdf installed!
  --html --word                            Output to HTML or Word. Must have Pandoc installed!
  -h, --help                               Displays this screen
  -h manifest | options |
    outputOptions | qa | docker | assets   See examples
  -d, --debug                              See debug Options
Default is ${manifestUtil.DEFAULT_MANIFEST.FILE_TYPES} unless specified in -m.

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

$ ${npmModuleName} --create /path/to/project --fullProject
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
  outputOptions: // TODO: Easier help options for understanding PDF, HTML, Word branding settings
`Supported key/value pairs for {outputOptions}:
  doctoc: true|false|"TOC title"            doctoc arguments. See https://www.npmjs.com/package/doctoc
      option: <value>
  pandoc:                                   pandoc arguments added to <value>. See https://pandoc.org/MANUAL.html#options
      key1: "-c mystyle.css"
      key2: "--template mytemplate.html"
      key3: "--reference-doc path/to/reference.docx"
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
    ${npmModuleName} -m manifest.yml --docker

  Alternatively you can download the docker files directly:
    ${npmModuleName} --getDockerFiles
    `,
  assets:
`Asset cleaning helps remove unused image files from your project directories.

Examples:
  ${npmModuleName} --clean-assets                    # Preview unused assets in current directory
  ${npmModuleName} --clean-assets ./modules --fix    # Delete unused assets in modules directory
  ${npmModuleName} --clean-assets --assets-dir images # Use 'images' folder instead of 'assets'
  
Asset Preview (automatic during merge):
  ${npmModuleName} -m manifest.yml                   # Shows unused assets summary after merge
  ${npmModuleName} -m manifest.yml --no-asset-preview # Disable asset preview
  
The tool scans markdown files for image references and identifies unused assets.
It supports YAML frontmatter 'copy-images-to' key for custom asset folder names.
    `
};

exports.run = run;