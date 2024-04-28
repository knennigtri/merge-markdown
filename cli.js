const packageInfo = require("./package.json");
const manifestUtil = require("./manifest.js");
const merge = require("./merge.js");
const presentation = require("./presentation.js");
const path = require('path');
const fs = require('fs');
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
    ...presentation.debbugOptions
};

function run() {
    var argsHelp = args.h || args.help;
    var argsVersion = args.v || args.version;
    var argsDebug = args.d || args.debug;
    var argsManifest = args.m || args.manifest;
    var argsQA = args.qa;
    var argsSkipLinkcheck = args.skipLinkcheck;
    var argsCreate = args.c || args.create;
    var argsMaintainAssetPaths = args.maintainAssetPaths;
    var docker = args.getDockerFiles;

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
        console.log("[Mac] $ DEBUG:<option> " + cliName + " -m <file>");
        console.log("[Win] $ set DEBUG=<option> & " + cliName + " -m <file>");
        console.log("Options: " + JSON.stringify(debbugOptions, null, 2));
        return;
    }
    if (argsQA) console.log("QA mode");
    if (argsSkipLinkcheck) console.log("noLinkcheck mode");
    if (argsMaintainAssetPaths) console.log("maintainAssetPaths mode");

    if(docker){
        console.log("Downloading docker files...")
        const dockerFileNames = ['docker-compose.yml', 'Dockerfile'];
        dockerFileNames.forEach((fileName) => {
            const sourcePath = path.join(__dirname, fileName);
            const destinationPath = path.join("./", fileName);
    
            // Copy the Docker file
            fs.copyFileSync(sourcePath, destinationPath);
            console.log("Copied " + fileName + " to " + path.resolve(destinationPath));
        });
        return;
    }

    if (argsCreate) {
        var inputFilesPath = ".";
        if (typeof argsCreate === 'string') {
            inputFilesPath = argsCreate;
        }
        console.log(inputFilesPath);
        manifestUtil.createManifestFile(inputFilesPath);
        return;
    }

    //Require -m
    //If file, expect a manifest file, otherwise look for default file in given directory
    var manifestFilePath;
    // if (argsManifest && argsManifest[0] != undefined && argsManifest[0] != "") {
    if (argsManifest && typeof argsManifest === 'string') {
        manifestFilePath = manifestUtil.getFile(argsManifest);
    } else { //if there is no -m check for a default manifest file
        manifestFilePath = manifestUtil.getFile("./");
    }
    if (manifestFilePath == undefined || manifestFilePath == "") {
        console.log("No manifest found. Consider auto-creating with -c or specify a manifest with -m");
        console.log(HELP.default);
        return;
    }

    debugCLI("manifest found at: " + manifestFilePath);
    console.log("Using: " + manifestFilePath);

    merge.start(manifestFilePath, argsQA, argsSkipLinkcheck, argsMaintainAssetPaths)
        .then(resultMarkdownFile => {
            //Add presentation
            var outputMode = "";
            if (args.html) outputMode = presentation.MODE.html;
            if (args.pdf) outputMode = presentation.MODE.pdf;
            return presentation.build(resultMarkdownFile, outputMode, manifestFilePath)
        })
        .then(resultFile => {
            console.log(resultFile + " created.")
        })
        .catch((error) => {
            console.error(`Error creating file: ${error}`);
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
  --getDockerFiles                         Downloads the Docker files to your local project
  --qa                                     QA mode.
  --skipLinkcheck                          Skips linkchecking
  --maintainAssetPaths                     Retains original asset paths
  --pdf                                    Output to PDF. Must have Pandoc and wkhtmltopdf installed!
  --html                                   Output to HTML. Must have Pandoc installed!
  -h, --help                               Displays this screen
  -h manifest | options |
    outputOptions | qa | docker            See examples
  -d, --debug                              See debug Options
Default manifest: `+ manifestUtil.DEF_MANIFEST_NAME + "[" + manifestUtil.DEF_MANIFEST_EXTS.join("|") + `] unless specified in -m.

Download Pandoc: https://pandoc.org/installing.html
Download wkhtmltopdf: https://wkhtmltopdf.org/downloads.html
`,
    manifest:
        `Example yaml in a manifest file:
---
    input:
    global-frontmatter.md: ""
    module1Folder/file1.md: {options}
    module2Folder/file2.md: {noYAML: true, doctoc: true, replace: {key:value}}
    output: 
    name: merged/myOutput.md
    {outputOptions}
    qa: {exclude: regex}
    {options}
---`,
    options:
        `Supported key/value pairs for {options}:
noYAML: true|false                 Optionlly removes YAML. Default=false
doctoc: true|false|"TOC title"     doctoc arguments. See https://www.npmjs.com/package/doctoc
    option: <value>
replace:                           Searches for key and replaces with value
    key: value
    <!--{key}-->: value              Example key for a useful identifier
    *: "stringVal"                   Regular expressions are allowed
`,
    outputoptions:
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
---
    qa: {exclude: "(frontmatter|preamble)"}
---`,
    docker:
    `Download the Docker image and yml:
    merge-markdown --getDockerFiles

Setup docker compose with your local project:
    docker compose up -d --build

Execute merge-markdown in docker:
    docker compose exec node merge-markdown -m yourManifest.yml --pdf

Download the desired output:
    docker compose cp node:/home/runner/workspace/yourOutput.pdf .
    `
}

exports.run = run;