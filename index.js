var minimist = require('minimist');
var fs = require('fs');
var packageInfo = require("./package.json");
var merge = require("./merge.js");


// Command line options
const MSG_HELP = `Usage: merge-markdown [OPTIONS]
Options:
  --type               [single | multi] specifys the type of module merge
  -m manifestName      Sets the manifest that contains an ordered list of modules. Default is manifest.txt
  -p modulePath        Only use with --type=single. Specifies the input path of the module location
  -q                   Sets the markdown link checker to quiet. (does not output success links)
  -h                   Displays this screen
  -v                   Displays version of this package`;

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
    if (args.v) {
      console.log(packageInfo.version);
      return;
    }

    var inputManifest = args.m || "./manifest.txt";
    var inputPath = args.p || "./";
    var outputPath = args.o || "output/";
    var outputFileName = "studentGuide";

    var mergeType;
    if(args.type == "multi") {
      console.log("Multi-module merge mode");
      mergeType = "multi";
      if(inputPath != "./") {
        console.log("Ignoring -p for --type merge")
      }
    }
    else if(args.type == "single") {
      console.log("Single module merge mode");
      mergeType = "single";
      if(inputPath == "./") {
        console.log("No module folder path given. Specify path with -p")
        console.log(MSG_HELP);
        return;
      }
      inputPath = inputPath.replace(/\/$/, '');
      if (!fs.existsSync(inputPath)){
        console.log("%s path does not exist.", inputPath);
        return;
      }
      outputFileName = inputPath;
      inputManifest = inputPath + "/" + inputManifest; 
    }
    else {
      console.log("Required: --type [single | multi]");
      console.log(MSG_HELP);
      return;
    } 

    //Manifest Input
    if (!fs.existsSync(inputManifest)){
      console.log("%s does not exist. Consider creating it.", inputManifest);
      return;
    }
    console.log("Using Manifest: %s", inputManifest);

    //Markdown file output
    outputPath = outputPath.replace(/\/$/, '');
    outputFileName = outputFileName.replace(/\.[^/.]+$/, "");
    var outputFile = outputPath + "/" + outputFileName + ".md";
    console.log("outputFile: %s", outputFile);
    
    //linkcheck file output
    var linkcheckFile = outputPath+"/"+outputFileName+".linkcheck.md";
    console.log("QA Linkcheckfile: %s", linkcheckFile);

    if(args.q) {
      console.log("markdown link checker set to quiet");
      var quiet = args.q;
    }

    merge.add(inputManifest, outputFile, linkcheckFile, quiet);
}

exports.init = init;