var minimist = require('minimist');
var fs = require('fs');
var packageInfo = require("./package.json");


// Command line options
const MSG_HELP = `Usage: aemfed [OPTIONS]
Options:
  --type               [single | multi] specifys the type of module merge
  -m manifestName      Sets the manifest that contains an ordered list of modules. Default is manifest.txt
  -p modulePath        Specifys the input path of the module location
  -q                   TRUE sets the markdown link checker to quiet. (does not output success links)
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

    var mergeType = 'multi';
    var inputType = args.type;
    if(args.type == "single") {
      console.log("this is a single module output");
      mergeType = "single";
    }
    else if(args.type == "multi") {
      console.log("this is a single module output");
      mergeType = "single";
    }
    else {
      console.log("Input Type should be [single | multi]");
      return;
    }
    

    var inputManifest = args.m || "manifest.txt";
    var inputPath = args.p || "";
    var outputPath = "output/";
    var outputFileName = "studentGuide";

    //Initial
    // console.log("Manifest: %s", inputManifest);
    // console.log("inputPath: %s", inputPath);
    // console.log("outputPath: %s", outputPath);
    
    if( mergeType == "single" && inputPath != "") {
      inputPath = inputPath.replace(/\/$/, '');
      outputFileName = inputPath;
      inputManifest = inputPath + "/" + inputManifest;
      if (!fs.existsSync(inputManifest)){
        console.log("%s does not exist. Consider creating it.", inputManifest);
        return;
      }
    } else {
      console.log("Current directory will be used.")
    }

    //Inputs
    console.log("Manifest: %s", inputManifest);

    //Outputs
    outputPath = outputPath.replace(/\/$/, '');
    outputFileName = outputFileName.replace(/\.[^/.]+$/, "");
    var outputLocation = outputPath + "/" + outputFileName + ".md";
    console.log("outputLocation: %s", outputLocation);
    
    if(args.qa) {
      console.log("QA links will be provided");
      var qa = args.qa;
    }
}

exports.init = init;