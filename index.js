var minimist = require('minimist');
var fs = require('fs');
var path = require('path');
var packageInfo = require("./package.json");
var merge = require("./merge.js");

const EXAMPLE_MANIFEST = `Example manifest.json
{
  "input": {
    "frontmatter.md": "",
    "module1Folder/file1.md": {options},
    "module2Folder/file2.md": {"noYAML":true,"TOC":true}
  },
  "output": "output/myOutput.md",
  {options}
}
`;
const MSG_HELP = `Usage: merge-markdown [OPTIONS]
Options:
  -m manifestName      Required json file that contains merging info.
  --options            Displays supported manifest {options}
  -v                   Sets verbose output
  -h                   Displays this screen
  --version            Displays version of this package
`+EXAMPLE_MANIFEST;
const MANIFEST_OPTIONS = `Manifest input file options:
Supported key/value pairs for {options}:
  "noYAML": true|false                      optionlly removes YAML. Default=false
  "TOC": true|false|"TOC title"             optionally adds a TOC to this file with doctoc. Default=false
  "replace": {                              searches for \${key} and replaces with "value"
      "timestamp": true|false|"stringVal"   true for todays date or add you own timestamp string
      *: "stringVal"                        replace any key string with the value string
  }
`;

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
    //Show manifest input options
    if(args.options) {
      console.log(MANIFEST_OPTIONS);
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
    if(!manifestJSON.input) {
      console.log("Manifest is missing input.");
      console.log(EXAMPLE_MANIFEST);
      return;
    }
    if(!manifestJSON.output) {
      console.log("Manifest is missing output.");
      console.log(EXAMPLE_MANIFEST);
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