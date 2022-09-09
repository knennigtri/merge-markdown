"use strict";
var merge = require("./merge.js");
var presentation = require("./presentation.js");
var minimist = require('minimist');
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var packageInfo = require("./package.json");
var args = minimist(process.argv.slice(2));
var debug = require('debug')('index');
var debugInput = require('debug')('index:input');
var debugManifest = require('debug')('index:manifest');
var debugmanifestJson = require('debug')('index:manifest:json');
var debugManifestGenerate = require('debug')('index:manifest:generate');

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
  --version                 Displays version of this package
  --qa                      QA mode.
  --nolinkcheck             Skips linkchecking
  --pdf                     Output to PDF. wkhtmltopdf must be installed http://wkhtmltopdf.org/downloads.html
  --html                    Output to HTML
  -h                        Displays this screen
  -h [manifest|options|qa]  See examples
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
  pandoc:
    option: <value>                         Pandoc arguments should be added to <value>
  wkhtmltopdf:
    option: <value>                         wkhtmltopdf options can be added based on node-wkhtmltopdf
      `;
const QA_HELP=`When --qa is set:
Output will exclude all filenames with 'frontmatter' by default
Add a regex to the `+DEF_MANIFEST_NAME+`.[`+DEF_MANIFEST_EXTS.join('|')+`] to customize exclusion:
---
  qa: {exclude: "(frontmatter|preamble)"}
---`;

/**
 * 
 * @param {*} manifestParam manifest file or folder of .md files
 * @param {*} qaParam boolean to turn on QA mode
 * @returns 
 */
var init = function(manifestParam, qaParam, noLinkcheckParam) {
  var argManifest = manifestParam || args.m;
  var argQA = qaParam || args.qa;
  var argHelp =  args.h || args.help;
  var argVersion = args.v || args.version;
  var argNoLinkcheck = noLinkcheckParam || args.nolinkcheck;

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
    try {
      var fsStat = fs.lstatSync(argManifest)
      if(fsStat.isDirectory()){
        debugInput("Using directory for manifest");
        manifestJSON = useFolderPath(argManifest, argQA);
        manifestRelPath = argManifest;
      }
      if(fsStat.isFile()){
        debugInput("Using file manifest");
        manifestJSON = getManifestJSON(argManifest, argQA);
        manifestRelPath = path.dirname(argManifest);
      }
    }
    catch (err) {
      console.log("Manifest input does not exist. Choose a valid folder or file.");
      console.log(MSG_HELP);
      return;
    }
  } else { //if there is no -m check for a default manifest file
    console.log("No -m argument given. Using default: "+ DEF_MANIFEST_NAME+".["+DEF_MANIFEST_EXTS.join('|')+"]");
    manifestJSON = getDefaultManifestJSON(".", argQA);
    manifestRelPath = ".";
  }

  if(manifestJSON && manifestJSON.length != 0){
    //print out manifest to be used
    debugManifest(JSON.stringify(manifestJSON, null, 2));
    merge.markdownMerge(manifestJSON, manifestRelPath, argQA, argNoLinkcheck); 
    if (args.html) {
      presentation.build(manifestJSON, manifestRelPath, presentation.MODE.html);
    } else if(args.pdf) {
      presentation.build(manifestJSON, manifestRelPath, presentation.MODE.pdf);
    }
  } else {
    console.log("Cannot read manifest.");
    console.log(EXAMPLE_MANIFEST);
    return;
  } 
  return; 
}

/**
 * Creates a valid manifest JSON based on input (or no input)
 * DEBUG=index:manifest:json
 */
var getManifestJSON = function(inputManifestFile, qaMode){
  var fileType = inputManifestFile.split('.').pop();
  if (!DEF_MANIFEST_EXTS.includes(fileType)) {
    console.log("Manifest extension must be: .["+DEF_MANIFEST_EXTS.join('|')+"]");
    console.log(MSG_HELP);
    return;
  }
  console.log("Found manifest to use: %s", inputManifestFile);
  var fileContents = fs.readFileSync(inputManifestFile, 'utf8');
  var jsonObj = "";
  try {
    //Attempt to read the YAML and output JSON
    var data = yaml.loadAll(fileContents,"json");
    var yamlContents = JSON.stringify(data[0], null, 2);
    jsonObj = JSON.parse(yamlContents);
  } catch {
    debugmanifestJson("Could not read YAML, attemping JSON")
    try {
      //Attempt to read JSON
      jsonObj = JSON.parse(fileContents);
    } catch(e){
      console.log("Manifest file does not contain valid YAML or JSON content.");
      return;
    }
  }

  // If the manifest doesn't have an output, generate the output name basedd on the manifest directory
  if(!jsonObj.output) {
    jsonObj.output = generateFileNameFromFolder(inputManifestFile);
    console.log("Manifest is missing output. "+path.parse(jsonObj.output).dir+"/ will be used.");
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
* within the inputPath directory
* DEBUG=index:manifest:generate
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
  debugManifestGenerate("inputFolder: " + inputFolder);
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
 * Creates a file name for the output based on the inputPath
 * default extension is md
 * DEBUG=index:manifest:generate
 */
function generateFileNameFromFolder(inputPath, extension){
  var ext = "md";
  //if there is a leading . remove it
  if(extension){
    if(extension.charAt(0) == ".") extension = extension.substring(1);
    ext = extension;
  }
  var inputFolder = "";
  if(fs.lstatSync(inputPath).isFile()){
    inputFolder = path.dirname(inputPath);
  } else {
    inputFolder = inputPath;
  }
  // get resolved path
  var pathStr = path.resolve(inputFolder);
  // get last directory in directory path
  var fileStr = pathStr.match(/([^\/]*)\/*$/)[1];
  return path.join("merged", fileStr + "." + ext);
}

/**
 * Returns a manifest JSON based on the inputFolder. 
 * Checks for default manifest before generating one.
 * DEBUG=index:manifest:generate
 */
function useFolderPath(inputFolder, qaMode){
  var defManifest = getDefaultManifestJSON(inputFolder, qaMode);
  if(defManifest && defManifest.length != 0){
    return defManifest;
  }
  console.log("No manifest file given. Using "+inputFolder+" folder to create manifest.");
  var generatedJSON = {"input": {},"output": ""};
  
  //Create ouput file name
  generatedJSON.output = generateFileNameFromFolder(inputFolder, merge.EXT.out);

  //Generate the input with all .md files in the inputFolder
  var inputList = generateInputListFromFolder(inputFolder, "");
  generatedJSON.input = inputList;

  debugManifestGenerate("Manifest Generated");
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
      debug("Found default "+DEF_MANIFEST_NAME+".["+DEF_MANIFEST_EXTS.join('|')+"]");
      return getManifestJSON(file, qaMode);
    }
    i++;
  }
  return;
}

exports.init = init;
exports.getManifestJSON = getManifestJSON;