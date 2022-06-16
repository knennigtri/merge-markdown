"use strict";
var minimist = require('minimist'),
fs = require('fs'),
path = require('path'),
yaml = require('js-yaml'),
packageInfo = require("./package.json"),
merge = require("./merge.js");
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
  `;
const QA_HELP=`When --qa is set:
Output will exclude all filenames with 'frontmatter' by default
Add a regex to the `+DEF_MANIFEST_NAME+`.[`+DEF_MANIFEST_EXTS.join('|')+`] to customize exclusion:
---
  qa: {exclude: "(frontmatter|preamble)"}
---`;

var  argManifest, argQA, argHelp, argVersion, argVerbose, argDebug;
/**
 * 
 * @param {*} manifestParam manifest file or folder of .md files
 * @param {*} qaParam boolean to turn on QA mode
 * @returns 
 */
var init = function(manifestParam, qaParam) {
  argHelp =  args.h;
  argVersion = args.version;
  argManifest = manifestParam || args.m;
  console.log("M: " + argManifest);
  argVerbose = args.v;
  argDebug = args.d;
  argQA = qaParam || args.qa;

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
  var inputManifest = argManifest;
  if(!inputManifest){
    console.log("No -m argument given. Using default: "+ DEF_MANIFEST_NAME+".["+DEF_MANIFEST_EXTS.join('|')+"]");
    inputManifest = getDefaultManifest(".");
  }
  if (!fs.existsSync(inputManifest)){
    console.log("Manifest input does not exist. Choose a valid folder or file.");
    console.log(MSG_HELP);
   return;
  } else if(fs.lstatSync(inputManifest).isDirectory()){
    useFolderPath(inputManifest);
  } else {
    mergeWithManifestFile(inputManifest,function(err, outputName){
      if(err) throw err;
      console.log(outputName + " created.");
    });
  }
  return; 
}

// var myCallback = function(err, outputName){
//   if(err) throw err;
//   console.log(outputName + " created.");
// }

/**
 * This method takes a valid manifest file and sends it to the merger
 * @param {*} inputManifestFile 
 * @returns 
 */
 var mergeWithManifestFile = function(inputManifestFile, qaParam, callback){
  var jsonObj = manifestJSON(inputManifestFile);
  var manifestRelPath = path.dirname(inputManifestFile);
  callback(false, merge.markdownMerge(jsonObj, manifestRelPath, argVerbose, argDebug, qaParam)); 
}

/**
 * Creates a valid manifest JSON based on input (or no input)
 * @param {*} inputManifestFile 
 * @returns 
 */
var manifestJSON = function(inputManifestFile){
  var fileType = inputManifestFile.split('.').pop();
  if (!DEF_MANIFEST_EXTS.includes(fileType)) {
    console.log("Manifest extension must be: .["+DEF_MANIFEST_EXTS.join('|')+"]");
    console.log(MSG_HELP);
    return;
  }
  console.log("Using Manifest: %s", inputManifestFile);
  var fileContents = fs.readFileSync(inputManifestFile, 'utf8');
  var manifestJSON = "";
  try {
    //Attempt to read the YAML and output JSON
    var data = yaml.loadAll(fileContents,"json");
    var yamlContents = JSON.stringify(data[0], null, 2);
    manifestJSON = JSON.parse(yamlContents);
  } catch {
    try {
      //Attempt to read JSON
      manifestJSON = JSON.parse(fileContents);
    } catch(e){
      console.log("Manifest file does not contain valid YAML or JSON content.");
      console.log(e);
    }
  }
  
  // If the manifest doesn't have an output, generate the output name basedd on the manifest directory
  if(!manifestJSON.output) {
    console.log("Manifest is missing output. out/curDir.out.md will be used.");
    manifestJSON.output = generateOutputFileName(inputManifestFile);
  }
  if(manifestJSON.output.split('.').pop() != "md"){
    console.log("output needs to be a .md file");
  }

  // If the manifest doesn't have an input, build the input with md files in the manifest directory
  if(!manifestJSON.input){
    console.log("Manifest is missing input, .md files in same directory as manifest will be used.");
    var inputList = generateInputListFromFolder(inputManifestFile, manifestJSON.output);
    manifestJSON.input = inputList;
  }

  if(argQA){
    if (!manifestJSON.qa || !manifestJSON.qa.exclude){
      console.log("No exclude patterns given for QA. Using default `frontmatter` for exclusion.")
      manifestJSON.qa = {"exclude":"frontmatter"};
    }
  }
  return manifestJSON;
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
 * Builds a manifest file with default configurations with the inputFolder path
 */
function useFolderPath(inputFolder){
  var defManifest = getDefaultManifest(inputFolder);
  if(defManifest != ""){
    mergeWithManifestFile(defManifest);
    return;
  }
  console.log("No manifest file given. Using "+inputFolder+" folder to create manifest.");
  var generatedJSON = {"input": {},"output": ""};
  
  //Create ouput file name
  generatedJSON.output = generateOutputFileName(inputFolder);

  //Generate the input with all .md files in the inputFolder
  var inputList = generateInputListFromFolder(inputFolder, "");
  generatedJSON.input = inputList;

  if (argVerbose) console.log("generated Manifest: "+ JSON.stringify(generatedJSON));
  merge.markdownMerge(generatedJSON, inputFolder, argVerbose, argDebug, argQA);
}

/**
 * Returns a file manifest.[md|yml|yaml|json] if it exists in the inputFolder directory
 */
function getDefaultManifest(inputFolder){
  var defManifest = path.join(inputFolder,DEF_MANIFEST_NAME)
  var i = 0;
  while(i < DEF_MANIFEST_EXTS.length){
    var file = defManifest.concat(".",DEF_MANIFEST_EXTS[i]);
    if(fs.existsSync(file)){
      return file;
    }
    i++;
  }
  return "";
}

exports.init = init;
exports.manifestJSON = manifestJSON;
exports.mergeWithManifestFile = mergeWithManifestFile;