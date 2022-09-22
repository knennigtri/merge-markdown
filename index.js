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
    module2Folder/file2.md: {noYAML: true, doctoc: true, replace: {key:value}}
  output: 
    name: merged/myOutput.md
    {outputOptions}
  qa: {exclude: regex}
  {options}
---`;
const MSG_HELP = `Usage: merge-markdown [ARGS]
Arguments:
  -m <manifestFile>                        Path to input folder, yaml, or json manifest
  -v, --version                            Displays version of this package
      --qa                                 QA mode.
      --nolinkcheck                        Skips linkchecking
      --pdf                                Output to PDF. wkhtmltopdf must be installed http://wkhtmltopdf.org/downloads.html
      --html                               Output to HTML
  -h, --help                               Displays this screen
  -h [manifest|options|outputOptions|qa]   See examples
Default manifest: `+DEF_MANIFEST_NAME+`.[`+DEF_MANIFEST_EXTS.join('|')+`] unless specified in -m.
`;
const MANIFEST_OPTIONS = `Supported key/value pairs for {options}:
  noYAML: true|false                 Optionlly removes YAML. Default=false
  doctoc: true|false|"TOC title"     doctoc arguments. See https://www.npmjs.com/package/doctoc
    option: <value>
  replace:                           Searches for key and replaces with value
    key: value
    <!--{key}-->: value              Example key for a useful identifier
    *: "stringVal"                   Regular expressions are allowed
`;
const MANIFEST_OUTPUT_OPTIONS = `Supported key/value pairs for {outputOptions}:
  doctoc: true|false|"TOC title"            doctoc arguments. See https://www.npmjs.com/package/doctoc
    option: <value>
  pandoc:                                   pandoc arguments added to <value>. See https://pandoc.org/MANUAL.html#options
    key1: "-c mystyle.css"
    key2: "--template mytemplate.html"
  wkhtmltopdf:                              wkhtmltopdf options. See https://www.npmjs.com/package/wkhtmltopdf#options
    pageSize: Letter
    footerLine: true
`;
const QA_HELP=`QA mode can optionally exclude files from the output.
Example: exclude all filenames with 'frontmatter' by default
---
  qa: {exclude: "(frontmatter|preamble)"}
---`;

/**
 * @param {*} manifestParam manifest file or folder of .md files
 * @param {*} qaParam boolean to turn on QA mode
 * @param {*} modeParam 'html' or 'pdf' for presentation output
 * @param {*} noLinkcheckParam true/false on nolinkchecking
 */
var init = function(manifestParam, qaParam, modeParam, noLinkcheckParam, maintainAssetPaths) {
  var argManifest = manifestParam || args.m;
  var argQA = qaParam || args.qa;
  var argHelp =  args.h || args.help;
  var argVersion = args.v || args.version;
  var argNoLinkcheck = noLinkcheckParam || args.nolinkcheck;
  var argMaintainAssetPaths = maintainAssetPaths || args.maintainAssetPaths;

  var argMode = modeParam || args.html || args.pdf

  // Show CLI help
  if (argHelp) {
    if(argHelp == true){
       console.log(MSG_HELP);
       return;
    }
    if(argHelp.toLowerCase() == "manifest") console.log(EXAMPLE_MANIFEST);
    if(argHelp.toLowerCase() == "options") console.log(EXAMPLE_MANIFEST + "\n" + MANIFEST_OPTIONS);
    if(argHelp.toLowerCase() == "qa") console.log(EXAMPLE_MANIFEST + "\n" + QA_HELP);
    if(argHelp.toLowerCase() == "outputoptions") console.log(EXAMPLE_MANIFEST + "\n" + MANIFEST_OUTPUT_OPTIONS);
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
    manifestJSON =  fixDeprecatedManifestEntry(manifestJSON);
    merge.markdownMerge(manifestJSON, manifestRelPath, argQA, argNoLinkcheck, argMaintainAssetPaths); 
    // return;
    if(modeParam == presentation.MODE.pdf || args.pdf){
      presentation.build(manifestJSON, manifestRelPath, presentation.MODE.pdf);
    } else if(modeParam == presentation.MODE.html || args.html){
      presentation.build(manifestJSON, manifestRelPath, presentation.MODE.html);
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
  console.log("Found manifest to use: " + inputManifestFile);
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

  // If the manifest doesn't have an output, generate the output name based on the manifest directory
  if(!jsonObj.output) {
    jsonObj.output = {};
    jsonObj.output.name = generateFileNameFromFolder(inputManifestFile);
    console.log("Manifest is missing output.name. "+jsonObj.output.name+" will be used.");
    debugmanifestJson("OUTPUT:\n" + JSON.stringify(jsonObj.output, null, 2));
  } else {
    jsonObj = fixDeprecatedManifestEntry(jsonObj);
  }
  
  if(jsonObj.output.name.split('.').pop() != "md"){
    console.log("output.name needs to be a .md file but found: " + jsonObj.output.name);
    return;
  }

  // If the manifest doesn't have an input, build the input with md files in the manifest directory
  if(!jsonObj.input){
    console.log("Manifest is missing input, .md files in same directoy as manifest will be used.");
    var inputList = generateInputListFromFolder(inputManifestFile, jsonObj.output.name);
    jsonObj.input = inputList;
    debugmanifestJson("INPUT:\n" + JSON.stringify(jsonObj.input, null, 2));
  } else {
    jsonObj = fixDeprecatedManifestEntry(jsonObj); 
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
  var generatedJSON = {"input": {},"output": {}};
  
  //Create ouput file name
  generatedJSON.output.name = generateFileNameFromFolder(inputFolder, merge.EXT.out);

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

/**
 * Method to organize the manifest for merge and presentation to 
 * allow for non-destructive updates to mege-markdown.
 * Important if users are coming from earlier versions of merge-markdown
 */
function fixDeprecatedManifestEntry(manifestFix){
  var updatesNeeded = "";
  //Fix output to allow for keys under the output
  if(typeof manifestFix.output === "string"){
    var name = manifestFix.output;
    delete manifestFix.output;
    manifestFix.output = {}
    manifestFix.output.name = name;
    updatesNeeded += "   manifest.output >> manifest.output.name.\n";
  }

  //Move all outputOptions under the output
  if(manifestFix.hasOwnProperty("mergedTOC")){
    manifestFix.output.doctoc = manifestFix.mergedTOC;  
    delete manifestFix.mergedTOC
    updatesNeeded += "   manifest.mergedTOC >> manifest.output.doctoc.\n";
  }
  if(manifestFix.hasOwnProperty("pandoc")){
    manifestFix.output.pandoc = manifestFix.pandoc;
    delete manifestFix.pandoc;
    updatesNeeded += "   manifest.pandoc >> manifest.output.pandoc.\n";
  }
  if(manifestFix.hasOwnProperty("wkhtmltopdf")){
    manifestFix.output.wkhtmltopdf = manifestFix.wkhtmltopdf;
    delete manifestFix.wkhtmltopdf;
    updatesNeeded += "   manifest.wkhtmltopdf >> manifest.output.wkhtmltopdf.\n";
  }

  //Update all TOC and mergedTOC keys to doctoc
  if(manifestFix.output.hasOwnProperty("TOC")){
    manifestFix.output.doctoc = manifestFix.output.TOC;  
    delete manifestFix.output.TOC
    updatesNeeded += "   manifest.output.TOC >> manifest.output.doctoc.\n";
  }
  if(manifestFix.output.hasOwnProperty("mergedTOC")){
    manifestFix.output.doctoc = manifestFix.output.mergedTOC;  
    delete manifestFix.output.mergedTOC;
    updatesNeeded += "   manifest.output.mergedTOC >> manifest.output.doctoc.\n";
  }
  if(manifestFix.hasOwnProperty("TOC")){
    manifestFix.doctoc = manifestFix.TOC;
    delete manifestFix.TOC;
    updatesNeeded += "   manifest.TOC >> manifest.doctoc.\n";
  }
  if(manifestFix.hasOwnProperty("input")){
    var update = false;
    for(var i in manifestFix.input){
      if(manifestFix.input[i].hasOwnProperty("TOC")){
        manifestFix.input[i].doctoc = manifestFix.input[i].TOC;
        delete manifestFix.input[i].TOC;
        update = true;
      }
    }
    if(update) updatesNeeded += "   manifest.input[item].TOC >> manifest.input[item].doctoc.\n";
  }

  //Display to the user which keys should be updated in their manifest
  if(updatesNeeded){
    console.log("[WARNING] Below entries are old. Consider updating your manifest:");
    console.log(updatesNeeded)
  }
  debugManifest(JSON.stringify(manifestFix, null, 2));
  return manifestFix;
}

exports.run = init;
exports.getManifestJSON = getManifestJSON;