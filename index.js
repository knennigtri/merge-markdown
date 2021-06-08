var minimist = require('minimist');
var fs = require('fs');
var path = require('path');
var packageInfo = require("./package.json");
var merge = require("./merge.js");

const EX_MANIFEST = `Example manifest.json
{
  "input": {
    "frontmatter.md": "",
    "module1Folder/file1.md": [OPTIONS],
    "module2Folder/file2.md": [OPTIONS]
  },
  "moduleTOCTitle": "#### Module Contents",
  "output": "output/myOutput.md",
}
`;
const MSG_HELP = `Usage: merge-markdown [OPTIONS]
Options:
  -m manifestName      json file that contains build info. Default is manifest.json
  -v                   Sets verbose output
  -h                   Displays this screen
  --version            Displays version of this package
`+EX_MANIFEST;

//TODO Figure out how to check and verify module outputs
var init = function() {
    "use strict";
    var args = minimist(process.argv.slice(2));

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
    var inputManifest = args.m;
    if (!fs.existsSync(inputManifest) || (inputManifest.split('.').pop() != "json")){
      console.log("Cannot find manifest file or it is not a JSON");
      console.log(MSG_HELP);
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

    var outputFile = manifestJSON.output;
    if(outputFile.split('.').pop() != "md"){
      console.log("output needs to be a .md file");
    }

   merge.add(manifestJSON, manifestRelPath, verbose);
}

exports.init = init;