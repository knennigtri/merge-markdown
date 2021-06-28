"use strict";
var minimist = require('minimist'),
fs = require('fs'),
path = require('path'),
yaml = require('js-yaml'),
packageInfo = require("./package.json"),
merge = require("./merge.js");
var args = minimist(process.argv.slice(2));

const DEFAULT_MANIFEST = "manifest.json";

const EXAMPLE_MANIFEST = `Example `+DEFAULT_MANIFEST+`
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
Default manifest: `+DEFAULT_MANIFEST+` unless specified in -m. 
If there is no manifest, all md files in the folder will be used.
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
Add a regex to the `+DEFAULT_MANIFEST+` to customize exclusion:
---
  qa: {exclude: "(frontmatter|preamble)"}
---`;

//TODO Figure out how to check and verify module outputs
var init = function() {
  // Show CLI help
  if (args.h) {
    if(args.h == true){
       console.log(MSG_HELP);
       return;
    }
    if(args.h.toLowerCase() == "manifest") console.log(EXAMPLE_MANIFEST);
    if(args.h.toLowerCase() == "options") console.log(MANIFEST_OPTIONS);
    if(args.h.toLowerCase() == "qa") console.log(QA_HELP);
    return;
  }

  // Show version
  if (args.version) {
    console.log(packageInfo.version);
    return;
  }

  //Verify Manifest exists
  var inputManifest = args.m;
  if(!inputManifest){
      useFolderPath(".");
  } else if (!fs.existsSync(inputManifest)){
     console.log("Manifest input is not valid. Choose a json file or folder.");
     console.log(MSG_HELP);
      return;
  } else if(fs.lstatSync(inputManifest).isDirectory()){
     useFolderPath(inputManifest);
  } else {
     useManifestFile(inputManifest);
  }
  return; 
}

/**
 * This method takes in a json file
 * @param {*} inputManifestFile 
 * @returns 
 */
function useManifestFile(inputManifestFile){
  var fileType = inputManifestFile.split('.').pop();
  if (fileType == null) {
    console.log("Cannot find manifest file or it is not a JSON");
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
  
  //Verify manifest has correct properties.
  if(!manifestJSON.input || !manifestJSON.output) {
    console.log("Manifest is missing input or output");
    console.log(EXAMPLE_MANIFEST);
    return;
  }
  var manifestRelPath = path.dirname(inputManifestFile);

  var outputFile = manifestJSON.output;
  if(outputFile.split('.').pop() != "md"){
    console.log("output needs to be a .md file");
  }

  if(args.qa){
    if (!manifestJSON.qa || !manifestJSON.qa.exclude){
      console.log("No exclude patterns given for QA. Using default `frontmatter` for exclusion.")
      manifestJSON.qa = {"exclude":"frontmatter"};
    }
  }
  merge.add(manifestJSON, manifestRelPath, args.v, args.d, args.qa);  
}

function useFolderPath(inputFolder){
  var defManifest = path.join(inputFolder,DEFAULT_MANIFEST)
  if(fs.existsSync(defManifest)){
    useManifestFile(defManifest);
    return;
  }
  console.log("No manifest file given. Using "+inputFolder+" folder to create manifest.");
  var generatedJSON = {"input": {},"output": ""};
  //Create ouput
  var outputFileStr = inputFolder.match(/([^\/]*)\/*$/)[1];
  if(outputFileStr == ".") outputFileStr = "merge";
  generatedJSON.output = outputFileStr + merge.EXT.out;
  //create input
  fs.readdirSync(inputFolder).forEach (file => {
    var add = true;
    if(file.endsWith(".md")){
      add = Object.keys(merge.EXT).every(extension =>{
        if(file.endsWith(merge.EXT[extension])) return false;
        return true;
      });
      if(add) generatedJSON.input[file] = "";
    }
  });

  if (args.v) console.log("generated JSON: "+ JSON.stringify(generatedJSON.input));
  merge.add(generatedJSON, inputFolder, args.v, args.d, args.qa);
}

exports.init = init;