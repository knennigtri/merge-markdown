var minimist = require('minimist');
var fs = require('fs');
var path = require('path');
var packageInfo = require("./package.json");
var merge = require("./merge.js");

const EX_MANIFEST = `Example manifest.json
{
  "input": [
    "module1Folder/file1.md",
    "module2Folder/file2.md"
  ],
  "output": "output/myOutput.md",
  "quiet": true
}
note: quiet is optional
`;
const MSG_HELP = `Usage: merge-markdown [OPTIONS]
Options:
  -m manifestName      json file that contains build info. Default is manifest.json
  -v                   Sets verbose output
  -h                   Displays this screen
  --version            Displays version of this package
`+EX_MANIFEST;

//TODO Figure out how to check and verify module outputs
//TODO make linkchecker optional
//TODO make doctoc optional
//TODO make yaml remover optional

var init = function() {
    "use strict";
    var args = minimist(process.argv.slice(2));
    console.log(args);

    // Show help
    if (args.h) {
      console.log(MSG_HELP);
      return;
    }
    // Show version
    if (args.version) {
      console.log(packageInfo.version);
      return;
    }
    var verbose = false;
    if(args.v) {
      verbose = true;
    }

    //Verify Manifest exists
    var inputManifest = args.m || "./manifest.json";
    if (!fs.existsSync(inputManifest)){
      console.log("%s does not exist. Consider creating it.", inputManifest);
      return;
    }
    console.log("Using Manifest: %s", inputManifest);
    var manifestJSON = JSON.parse(fs.readFileSync(inputManifest, 'utf8'));

    //Verify manifest has correct properties.
    if(!manifestJSON.hasOwnProperty("input")) {
      console.log("Manifest is missing input.");
      console.log(EX_MANIFEST);
      return;
    }
    if(!manifestJSON.hasOwnProperty("output")) {
      console.log("Manifest is missing output.");
      console.log(EX_MANIFEST);
      return;
    }

    var manifestRelPath = path.dirname(inputManifest);

    var inputList = manifestJSON.input;
    var outputFile = manifestJSON.output;
    if(outputFile.split('.').pop() != "md"){
      console.log("output needs to be a .md file");
    }

    console.log("Input: " + inputList);
    console.log("Ouput: " + outputFile);

    if(args.q) {
      console.log("markdown link checker set to quiet");
      var quiet = args.q;
    }
    merge.add(manifestJSON, manifestRelPath, verbose);
}

exports.init = init;