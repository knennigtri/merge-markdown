const packageInfo = require("./package.json");
const mergeMarkdown = require("./index.js");
const merge = require("./merge.js");
const presentation = require("./presentation.js");
const minimist = require("minimist");
const args = minimist(process.argv.slice(2));
var fs = require("fs");
var path = require("path");
const yaml = require('js-yaml');
//https://www.npmjs.com/package/debug
//Mac: DEBUG=* merge-markdown....
//WIN: set DEBUG=* & merge-markdown....
const debug = require("debug");
const { dir, count } = require("console");
const debugArgs = debug("args");
const debugCLI = debug("cli");

const debbugOptions = {
    ...{
        "*": "Output all debugging messages",
        "args": "See CLI argument messages",
        "cli": "Validate CLI logic"
    },
    ...mergeMarkdown.debbugOptions,
    ...merge.debbugOptions,
    ...presentation.debbugOptions
};

function run() {
    var argsHelp = args.h || args.help;
    var argsVersion = args.v || args.version;
    var argsDebug = args.d || args.debug;
    var argsManifest = args.m || args.manifest;
    var argsQA = args.qa;
    var argsNoLinkcheck = args.nolinkcheck;
    var argsCreate = args.c || args.create;

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
        console.log("[Mac] $ DEBUG:<option> mergemarkdown -m <file>");
        console.log("[Win] $ set DEBUG=<option> & mergemarkdown -m <file>");
        console.log("Options: " + JSON.stringify(debbugOptions, null, 2));
        return;
    }
    if (argsQA) {
        console.log("QA mode");
        return;
    }
    if (argsNoLinkcheck) {
        console.log("No Linkcheck");
        return;
    }
    if (argsCreate) {
        var createPath = ".";
        if (typeof argsCreate === 'string') {
            createPath = argsCreate;
        }
        console.log(createPath);
        createManifest(createPath);
        return;
    }

    //Require -m
    //If file, expect a manifest file, otherwise look for default file in given directory
    var manifestDirPath = "";
    var manifestPath;
    if (argsManifest && argsManifest[0] != undefined && argsManifest[0] != "") {
        manifestPath = getManifestFile(argsManifest);
    } else { //if there is no -m check for a default manifest file
        console.log("No manifest parameter given. Consider auto-creating one");
        console.log(HELP.default);
        return;
    }
    if (manifestPath == undefined || manifestPath == "") return;
    manifestDirPath = path.dirname(manifestPath);

    // manifestJSON = getManifestJSON(manifestPath, argQA); ///????

    //merge-markdown cxreate:manifest
    //Looks through the entired director/subdirectory for md files and adds them to the input: as relative directories
    //standard output
    //outputs it into the current directory
    //TODO 


}
exports.run = run;

/**
 * Gets a valid file of manifest.[yaml|yml|json]
 * @param {} inputArg file/directory given in -m param
 * @returns file
 */
function getManifestFile(inputArg) {
    try {
        var fsStat = fs.lstatSync(inputArg);
        if (fsStat.isFile()) { //Set if file is given
            const e = path.extname(inputArg).toLowerCase();
            if (e === '.yml' || e === '.yaml' || e === '.json') {
                debugCLI("Using given manifest: " + inputArg);
                return inputArg;
            } else {
                console.log("Manifest file can only be yml|yaml|json");
                console.log(HELP.default);
                return;
            }
        } else if (fsStat.isDirectory()) { //Search for default manifest if directory
            debugCLI("Searching for manifest.yaml|yml|json in " + inputArg);
            const directory = inputArg;
            const possibleFileNames = ['manifest.yaml', 'manifest.yml', 'manifest.json'];
            //Look for a manifest file in the given directory
            for (const fileName of possibleFileNames) {
                const filePath = path.join(directory, fileName);
                try {
                    var fileStat = fs.lstatSync(filePath);
                    if (fileStat.isFile()) {
                        debugCLI("Using default manifest: " + filePath);
                        return filePath;
                    }
                } catch (err) {
                    debugCLI(filePath + " DNE.");
                }
            }
            console.log("No default manifest file found in " + directory);
        }
    }
    catch (err) {
        console.error(err);
    }
}

/**
 * Autocreates a starter manifest file 
 * @param {*} dir location of input files
 */
function createManifest(dir) {
    const jsonObject = {
        input: {},
        output: {
            "name": path.join(dir, "target/mergedFile.md"),
            "doctoc": true,
            "pandoc": {
                "css": "-c path/to/theme.css",
                "latexTemplate": "--template path/to/latex/template.html"
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
        qa: { exclude: "(frontmatter|preamble)" },
        replace: {
            "<!--{timestamp}-->": "01/01/2024",
            "<!--{title}-->": "My Title",
            "<!--{author}-->": "Chuck Grant",
            "### My h3 title": "#### My h4 title"
        }
    };
    var inputArr = findMarkdownFiles(dir);
    var counter = 0;
    inputArr.forEach(file => {
        var inputOptions = {
            noYAML: true, 
            doctoc: true,
            replace: {
                "\\[#\\]": counter
            }
        };
        jsonObject.input[file] = JSON.stringify(inputOptions);
        counter++;
    });

    //Write YAML File
    const yamlString = yaml.dump(jsonObject);
    const manifestPath = path.join(process.cwd(), 'manifest.yml')
    try {
        fs.writeFileSync(manifestPath, yamlString);
        console.log('YAML file successfully created: ' + manifestPath);
    } catch (error) {
        console.error('Error writing: ' + manifestPath, error);
    }
}

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
            if (path.extname(file).toLowerCase() === '.md') {
                markdownFiles.push(filePath);
            }
        }
    }
    return markdownFiles;
}


const DEF_MANIFEST_NAME = "manifest";
const DEF_MANIFEST_EXTS = ["md", "yaml", "yml", "json"];
const HELP = {
    default:
        `Usage: merge-markdown [ARGS]
Arguments:
  -m, --manifest <manifestFile>            Path to input folder, yaml, or json manifest
  -v, --version                            Displays version of this package
  -c, --create <path>                      auto-creates manifest file in <path>. Default is current directory
  --qa                                     QA mode.
  --nolinkcheck                            Skips linkchecking
  --pdf                                    Output to PDF. Must have Pandoc and wkhtmltopdf installed!
  --html                                   Output to HTML. Must have Pandoc installed!
  -h, --help                               Displays this screen
  -h [manifest|options|outputOptions|qa]   See examples
  -d, --debug                              See debug Options
Default manifest: `+ DEF_MANIFEST_NAME + ".[" + DEF_MANIFEST_EXTS.join("|") + `] unless specified in -m.

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
---`
}