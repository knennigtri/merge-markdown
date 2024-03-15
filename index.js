"use strict";
var merge = require("./merge.js");
var presentation = require("./presentation.js");
var minimist = require("minimist");
var fs = require("fs");
var path = require("path");
var yaml = require("js-yaml");
var packageInfo = require("./package.json");
var args = minimist(process.argv.slice(2));
var debug = require("debug")("index");
var debugInput = require("debug")("index:input");
var debugManifest = require("debug")("index:manifest");
var debugDeprication = require("debug")("index:deprecation");
var debugmanifestJson = require("debug")("index:manifest:json");
var debugManifestGenerate = require("debug")("index:manifest:generate");

exports.debbugOptions = {
  "index": "",
  "index:input": "",
  "index:manifest": "",
  "index:deprecation": "",
  "index:manifest:json": "",
  "index:manifest:generate": "",
};

/**
 * @param {*} manifestParam manifest file or folder of .md files
 * @param {*} qaParam boolean to turn on QA mode
 * @param {*} modeParam "html" or "pdf" for presentation output
 * @param {*} noLinkcheckParam true/false on nolinkchecking
 */
var init = function(manifestParam, qaParam, modeParam, noLinkcheckParam, maintainAssetPaths) {
  var argManifest = manifestParam || args.m;
  var argQA = qaParam || args.qa;
  var argNoLinkcheck = noLinkcheckParam || args.nolinkcheck;
  var argMaintainAssetPaths = maintainAssetPaths || args.maintainAssetPaths;

  //Verify Manifest exists
  var manifestJSON;
  var manifestRelPath = "";
  //if -m is given use the file/folder
  if(argManifest && argManifest[0] != undefined && argManifest[0] != ""){
    try {
      var fsStat = fs.lstatSync(argManifest);
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
      console.error(err);
      console.error("Manifest does not exist or has incorrect syntax. Choose a valid folder or file.");
      console.error(MSG_HELP);
      throw err;
    }
  } else { //if there is no -m check for a default manifest file
    console.log("No -m argument given. Using default: "+ DEF_MANIFEST_NAME+".["+DEF_MANIFEST_EXTS.join("|")+"]");
    manifestJSON = getDefaultManifestJSON(".", argQA);
    manifestRelPath = ".";
  }

  if(manifestJSON && manifestJSON.length != 0){
    //print out manifest to be used
    manifestJSON =  fixDeprecatedManifestEntry(manifestJSON);
    debugManifest(JSON.stringify(manifestJSON, null, 2));
    merge.markdownMerge(manifestJSON, manifestRelPath, argQA, argNoLinkcheck, argMaintainAssetPaths); 
    // return;
    if(args.pdf || (modeParam == presentation.MODE.pdf)){
      presentation.build(manifestJSON, manifestRelPath, presentation.MODE.pdf);
    } else if(args.html || (modeParam == presentation.MODE.html)){
      presentation.build(manifestJSON, manifestRelPath, presentation.MODE.html);
    }
  } else {
    console.log("Cannot read manifest.");
    console.log(EXAMPLE_MANIFEST);
    return;
  } 
  return; 
};

/**
 * Creates a valid manifest JSON based on input (or no input)
 * DEBUG=index:manifest:json
 */
var getManifestJSON = function(inputManifestFile, qaMode){
  var fileType = inputManifestFile.split(".").pop();
  if (!DEF_MANIFEST_EXTS.includes(fileType)) {
    console.log("Manifest extension must be: .["+DEF_MANIFEST_EXTS.join("|")+"]");
    console.log(MSG_HELP);
    return;
  }
  console.log("Found manifest to use: " + inputManifestFile);
  var fileContents = fs.readFileSync(inputManifestFile, "utf8");
  var jsonObj = "";
  try {
    //Attempt to read the YAML and output JSON
    var data = yaml.loadAll(fileContents,"json");
    var yamlContents = JSON.stringify(data[0], null, 2);
    jsonObj = JSON.parse(yamlContents);
  } catch {
    debugmanifestJson("Could not read YAML, attemping JSON");
    try {
      //Attempt to read JSON
      jsonObj = JSON.parse(fileContents);
    } catch(e){
      console.log("Manifest file does not contain valid YAML or JSON content.");
      throw e;
    }
  }

  // If the manifest doesn"t have an output, generate the output name based on the manifest directory
  if(!jsonObj.output) {
    jsonObj.output = {};
    jsonObj.output.name = generateFileNameFromFolder(inputManifestFile);
    console.log("Manifest is missing output.name. "+jsonObj.output.name+" will be used.");
    debugmanifestJson("OUTPUT:\n" + JSON.stringify(jsonObj.output, null, 2));
  } else {
    jsonObj = fixDeprecatedManifestEntry(jsonObj);
  }
  
  if(jsonObj.output.name.split(".").pop() != "md"){
    console.log("output.name needs to be a .md file but found: " + jsonObj.output.name);
    return;
  }

  // If the manifest doesn"t have an input, build the input with md files in the manifest directory
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
      console.log("No exclude patterns given for QA. Using default `frontmatter` for exclusion.");
      jsonObj.qa = {"exclude":"frontmatter"};
    }
  }
  return jsonObj;
};

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
  var fileStr = path.basename(pathStr);
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
  var defManifest = path.join(inputFolder,DEF_MANIFEST_NAME);
  var i = 0;
  while(i < DEF_MANIFEST_EXTS.length){
    var file = defManifest.concat(".",DEF_MANIFEST_EXTS[i]);
    if(fs.existsSync(file)){
      debug("Found default "+DEF_MANIFEST_NAME+".["+DEF_MANIFEST_EXTS.join("|")+"]");
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
    manifestFix.output = {};
    manifestFix.output.name = name;
    updatesNeeded += "   manifest.output >> manifest.output.name.\n";
  }

  //Move all outputOptions under the output
  if(Object.prototype.hasOwnProperty.call(manifestFix, "mergedTOC")){
    manifestFix.output.doctoc = manifestFix.mergedTOC;  
    delete manifestFix.mergedTOC;
    updatesNeeded += "   manifest.mergedTOC >> manifest.output.doctoc.\n";
  }
  if(Object.prototype.hasOwnProperty.call(manifestFix, "pandoc")){
    manifestFix.output.pandoc = manifestFix.pandoc;
    delete manifestFix.pandoc;
    updatesNeeded += "   manifest.pandoc >> manifest.output.pandoc.\n";
  }
  if(Object.prototype.hasOwnProperty.call(manifestFix,"wkhtmltopdf")){
    manifestFix.output.wkhtmltopdf = manifestFix.wkhtmltopdf;
    delete manifestFix.wkhtmltopdf;
    updatesNeeded += "   manifest.wkhtmltopdf >> manifest.output.wkhtmltopdf.\n";
  }

  //Update all TOC and mergedTOC keys to doctoc
  if(Object.prototype.hasOwnProperty.call(manifestFix.output,"TOC")){
    manifestFix.output.doctoc = manifestFix.output.TOC;  
    delete manifestFix.output.TOC;
    updatesNeeded += "   manifest.output.TOC >> manifest.output.doctoc.\n";
  }
  if(Object.prototype.hasOwnProperty.call(manifestFix.output,"mergedTOC")){
    manifestFix.output.doctoc = manifestFix.output.mergedTOC;  
    delete manifestFix.output.mergedTOC;
    updatesNeeded += "   manifest.output.mergedTOC >> manifest.output.doctoc.\n";
  }
  if(Object.prototype.hasOwnProperty.call(manifestFix,"TOC")){
    manifestFix.doctoc = manifestFix.TOC;
    delete manifestFix.TOC;
    updatesNeeded += "   manifest.TOC >> manifest.doctoc.\n";
  }
  if(Object.prototype.hasOwnProperty.call(manifestFix,"input")){
    var update = false;
    for(var i in manifestFix.input){
      if(Object.prototype.hasOwnProperty.call(manifestFix.input[i],"TOC")){
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
    console.log(updatesNeeded);
  }
  debugDeprication(JSON.stringify(manifestFix, null, 2));
  return manifestFix;
}

exports.run = init;
exports.getManifestJSON = getManifestJSON;