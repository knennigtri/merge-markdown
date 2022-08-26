"use strict";
var minimist = require('minimist');
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var packageInfo = require("./package.json");
var merge = require("./merge.js");
var mergedContent = require("./mergedContent.js");
var args = minimist(process.argv.slice(2));

const DEF_MANIFEST_NAME = "manifest";
const DEF_MANIFEST_EXTS = ["md","yaml","yml","json"];

const EXAMPLE_MANIFEST = `Example yaml in a manifest file:
---
  input:
    global-frontmatter.md: ""
    module1Folder/file1.md: {options}
    module2Folder/file2.md: {noYAML: true, TOC: true}
  output: output/myOutput.md
  qa: {exclude: frontmatter}
  {options}
---`;
const MSG_HELP = `Usage: merge-markdown [OPTIONS]
Options:
  -m manifestPath           Path to input folder, yaml, or json manifest
  --qa                      QA mode.
  --version                 Displays version of this package
  -v                        Verbose output
  -d                        Debug output
  -h                        Displays this screen
  -h [manifest|options|qa]  See examples
  --pdf                     Merged markdown file to pdf
  --html                    Merged mardown file to html
Default manifest: `+DEF_MANIFEST_NAME+`.[`+DEF_MANIFEST_EXTS.join('|')+`] unless specified in -m.
`;
const MANIFEST_OPTIONS = `Manifest input file options:
Supported key/value pairs for {options} within the manifest file:
  noYAML: true|false                        optionlly removes YAML. Default=false
  TOC: true|false|"TOC title"               optionally adds a TOC to this file with doctoc. Default=false
  replace:                                  searches for <!--{key}--> and replaces with value
      startStr: replaceStrStart             optional. Set a unqiue start str for replace. Default is <!--{
      endStr: replaceStrEnd                 optional. Set a unqiue end str for replace. Default is }-->
      timestamp: true|false|"stringVal"     true for todays date or add you own timestamp string
      *: "stringVal"                        replace any key string with the value string
Supported key/value pairs only supported at a manifest level and not module level:
  mergedTOC: true|false                     TOC built by doctoc at the beginning of the merged file
      `;
const QA_HELP=`When --qa is set:
Output will exclude all filenames with 'frontmatter' by default
Add a regex to the `+DEF_MANIFEST_NAME+`.[`+DEF_MANIFEST_EXTS.join('|')+`] to customize exclusion:
---
  qa: {exclude: "(frontmatter|preamble)"}
---`;

var argVerbose, argDebug;
/**
 * 
 * @param {*} manifestParam manifest file or folder of .md files
 * @param {*} qaParam boolean to turn on QA mode
 * @returns 
 */
var init = function(manifestParam, qaParam) {
  var argManifest = manifestParam || args.m;
  var argQA = qaParam || args.qa;
  var argHelp =  args.h || args.help;
  var argVersion = args.v || args.version;
  var argToHTML = args.html
  var argToPDF = args.pdf
  argVerbose = args.verbose;
  argDebug = args.d || args.debug;

  // Show CLI help
  if (argHelp) {
    if(argHelp == true){
       console.log(MSG_HELP);
       return;
    }
    if(argHelp.toLowerCase() == "manifest") console.log(EXAMPLE_MANIFEST);
    if(argHelp.toLowerCase() == "options") console.log(MANIFEST_OPTIONS);
    if(argHelp.toLowerCase() == "qa") console.log(QA_HELP);
    return;
  }

  // Show version
  if (argVersion) {
    console.log(packageInfo.version);
    return;
  }

  //Verify Manifest exists
  var manifestJSON;
  var manifestRelPath = "";
  //if -m is given use the file/folder
  if(argManifest && argManifest[0] != undefined && argManifest[0] != ""){
    if(fs.lstatSync(argManifest).isDirectory()){
      if (argDebug) console.log("Using directory for manifest");
      manifestJSON = useFolderPath(argManifest, args.qa);
      manifestRelPath = argManifest;
    }
    if(fs.lstatSync(argManifest).isFile()){
      if (argDebug) console.log("Using file manifest");
      manifestJSON = getManifestJSON(argManifest, args.qa);
      manifestRelPath = path.dirname(argManifest);
    }
  } else { //if there is no -m check for a default manifest file
    console.log("No -m argument given. Using default: "+ DEF_MANIFEST_NAME+".["+DEF_MANIFEST_EXTS.join('|')+"]");
    manifestJSON = getDefaultManifestJSON(".", args.qa);
    manifestRelPath = "./";
  }

  if(manifestJSON && manifestJSON.length != 0){
    //print out manifest to be used
    if (argDebug) console.log(JSON.stringify(manifestJSON, null, 2));
    //merge.markdownMerge(manifestJSON, manifestRelPath, argVerbose, argDebug, args.qa); 
  } else {
    console.log("Manifest input does not exist. Choose a valid folder or file.");
    console.log(MSG_HELP);
    return;
  } 

  //TODO Allow for PDF creation without a manifest
  //TODO Allow for qa mode (different output name)
  if (argToHTML) {
    if(!argManifest){
      console.log("No -m argument given. Output PDF will use default css and latexTemplate.");
    }
    mergedContent.build(argManifest,'html',pandocJSON);
  }
  if (argToPDF) {
    if(!argManifest){
      console.log("No -m argument given. Output PDF will use default css and latexTemplate.");
    }
    mergedContent.build(argManifest,'pdf',pandocJSON, wkhtmltopdfJSON);
  }

  return; 
}

/**
 * Creates a valid manifest JSON based on input (or no input)
 */
var getManifestJSON = function(inputManifestFile, qaMode){
  var fileType = inputManifestFile.split('.').pop();
  if (!DEF_MANIFEST_EXTS.includes(fileType)) {
    console.log("Manifest extension must be: .["+DEF_MANIFEST_EXTS.join('|')+"]");
    console.log(MSG_HELP);
    return;
  }
  console.log("Using Manifest: %s", inputManifestFile);
  var fileContents = fs.readFileSync(inputManifestFile, 'utf8');
  var jsonObj = "";
  try {
    //Attempt to read the YAML and output JSON
    var data = yaml.loadAll(fileContents,"json");
    var yamlContents = JSON.stringify(data[0], null, 2);
    jsonObj = JSON.parse(yamlContents);
  } catch {
    try {
      //Attempt to read JSON
      jsonObj = JSON.parse(fileContents);
    } catch(e){
      console.log("Manifest file does not contain valid YAML or JSON content.");
      console.log(e);
    }
  }
  
  // If the manifest doesn't have an output, generate the output name basedd on the manifest directory
  if(!jsonObj.output) {
    console.log("Manifest is missing output. out/curDir.out.md will be used.");
    jsonObj.output = generateOutputFileName(inputManifestFile);
  }
  if(jsonObj.output.split('.').pop() != "md"){
    console.log("output needs to be a .md file");
  }

  // If the manifest doesn't have an input, build the input with md files in the manifest directory
  if(!jsonObj.input){
    console.log("Manifest is missing input, .md files in same directory as manifest will be used.");
    var inputList = generateInputListFromFolder(inputManifestFile, jsonObj.output);
    jsonObj.input = inputList;
  }

  if(qaMode){
    if (!jsonObj.qa || !jsonObj.qa.exclude){
      console.log("No exclude patterns given for QA. Using default `frontmatter` for exclusion.")
      jsonObj.qa = {"exclude":"frontmatter"};
    }
  }
  return jsonObj;
}

/* Creates a json of all .md files that are:
* within the inputPath directory directory
* not the inputPath (if it's a file)
*/
function generateInputListFromFolder(inputPath, outputFileStr){
  var inputFolder = "";
  var inputFile = "";
  if(fs.lstatSync(inputPath).isFile()){
    inputFolder = path.dirname(inputPath);
    inputFile = path.basename(inputPath);
  } else {
    inputFolder = inputPath;
  }
  if (argVerbose) console.log("inputFolder: " + inputFolder);
  var generatedInputJSON = {};
  //create input
  fs.readdirSync(inputFolder).forEach (file => {
    var add = true;
    //Make sure the file ends in .md, is not a folder, and not the output file name
    if(file.endsWith(".md") && file != inputFile && !outputFileStr.includes(file)){
      add = Object.keys(merge.EXT).every(extension =>{
        if(file.endsWith(merge.EXT[extension])) return false;
        return true;
      });
      if(add) generatedInputJSON[file] = "";
    }
  });
  return generatedInputJSON;
}

/**
 * Creates a file name for the output file based on the inputPath
 */
function generateOutputFileName(inputPath){
  var inputFolder = "";
  if(fs.lstatSync(inputPath).isFile()){
    inputFolder = path.dirname(inputPath);
  } else {
    inputFolder = inputPath;
  }
  // get resolved path
  var pathStr = path.resolve(inputFolder);
  // get last directory in directory path
  var outputFileStr = pathStr.match(/([^\/]*)\/*$/)[1];
  return "merged/" + outputFileStr + merge.EXT.out;
}

/**
 * Returns a manifest JSON based on the inputFolder. 
 * Checks for default manifest before generating one.
 */
function useFolderPath(inputFolder, qaMode){
  var defManifest = getDefaultManifestJSON(inputFolder, qaMode);
  if(defManifest && defManifest.length != 0){
    return defManifest;
  }
  console.log("No manifest file given. Using "+inputFolder+" folder to create manifest.");
  var generatedJSON = {"input": {},"output": ""};
  
  //Create ouput file name
  generatedJSON.output = generateOutputFileName(inputFolder);

  //Generate the input with all .md files in the inputFolder
  var inputList = generateInputListFromFolder(inputFolder, "");
  generatedJSON.input = inputList;

  if (argVerbose) console.log("generated Manifest: "+ JSON.stringify(generatedJSON));
  return generatedJSON;
}

/**
 * Returns a JSON of the manifest.[md|yml|yaml|json] if it exists in the inputFolder directory
 */
function getDefaultManifestJSON(inputFolder, qaMode){
  var defManifest = path.join(inputFolder,DEF_MANIFEST_NAME)
  var i = 0;
  while(i < DEF_MANIFEST_EXTS.length){
    var file = defManifest.concat(".",DEF_MANIFEST_EXTS[i]);
    if(fs.existsSync(file)){
      if (argDebug) console.log("Found default "+DEF_MANIFEST_NAME+".["+DEF_MANIFEST_EXTS.join('|')+"]");
      return getManifestJSON(file, qaMode);
    }
    i++;
  }
  return;
}

exports.init = init;
exports.getManifestJSON = getManifestJSON;