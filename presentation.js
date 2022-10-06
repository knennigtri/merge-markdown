var path = require("path");
var nodePandoc = require("node-pandoc");
var wkhtmltopdf = require("wkhtmltopdf");
var debug = require("debug")("presentation");
var debugHTML = require("debug")("presentation:html");
var debugHTMLOptions = require("debug")("presentation:html:options");
var debugPDF = require("debug")("presentation:pdf");
var debugPDFOptions = require("debug")("presentation:pdf:options");
var verbose = require("debug")("verbose");
var fs = require("fs");
var MODE = {
  "pdf": "pdf",
  "html": "html"
};
var EXT = {
  "pdf": "."+MODE.pdf,
  "html": "."+MODE.html
};

exports.MODE = MODE;

var build = async function(jsonObj, inputPath, mode){
  //TODO remove?
  var promise = new Promise(res => {
    setTimeout(() => res("Now it's done!"), 5000);
  });
  await promise; 

  console.log("Creating presentation...");
  
  debug("Presentation output: " + mode);
  var absInputPath = path.resolve(inputPath);

  // var manifestABSPath = path.parse(inputPath).dir;
  debug("Input: " + absInputPath);

  //Set the output location of documents
  var absManifestOutputPath = path.parse(jsonObj.output.name).dir;
  var absManifestOutputFileName = path.parse(jsonObj.output.name).base;
  var absOutputPath = path.join(absInputPath,absManifestOutputPath);
  //Location of merge-markdown file
  var absMMFileName = path.join(absOutputPath,absManifestOutputFileName);

  console.log(mode.toUpperCase() + " mode selected for " + absManifestOutputFileName);
  console.log("+++++++++++++");
  toHTML(jsonObj, absMMFileName, absInputPath, mode);
};

/**
 * Input and Output files are expected to be ABS
 */
function toHTML(manifestJson, inputFile, inputPath, mode){
  debug("Creating HTML...");
  var outputFile = path.join(path.parse(inputFile).dir, "temp.html");
  var pandocArgs = buildPandocArgs(manifestJson.output.pandoc, inputPath, outputFile);
  debugHTML("input: "+inputFile);
  debugHTML("Args: '" + pandocArgs + "'");
  nodePandoc(inputFile, pandocArgs, function (err, result) {
    if (err) {
      console.error("Error: Verify the pandoc arguments according to pandoc documentation");
      console.error(err);
    } else {
      console.log(" pandoc: "+ path.parse(inputFile).base + " >> "+ path.parse(outputFile).base);
      switch (mode){
      case MODE.pdf:
        toPDF(manifestJson, outputFile, mode);
        break;
      case MODE.html:
        renameToManifestOutputName(manifestJson, outputFile, mode);
        break;
      default:
        return;
      }
      verbose(result);
    }
  });
}

/**
 * Input and Output files are expected to be ABS
 */
function toPDF(manifestJson, inputFile, mode){
  debug("Creating PDF...");
  var outputFile = path.join(path.parse(inputFile).dir, "temp.pdf");
  var options = buildWkhtmltopdfOptions(manifestJson.output.wkhtmltopdf, outputFile);
  debugPDF("input: "+inputFile);
  debugPDF("Args: "+JSON.stringify(options, null, 2));
  wkhtmltopdf(fs.createReadStream(inputFile), options, function (err, result) {
    if (err) {
      if(err.toString().includes("spawn wkhtmltopdf ENOENT")) console.error("Error: Make sure wkhtmltopdf is installed from http://wkhtmltopdf.org/downloads.html");
      else console.error("Error: Verify the wkhtmltopdf options according to wkhtmltopdf documentation");
      console.error(err);
    } else {
      console.log(" wkhtmltopdf: "+ path.parse(inputFile).base + " >> "+ path.parse(outputFile).base);
      renameToManifestOutputName(manifestJson, outputFile, mode);
      verbose(result);
    }
  });
}

function buildPandocArgs(jsonObj, inputPath, fileName){
  var cliArgs = "-o " + fileName;
  if(jsonObj){
    for (var key in jsonObj){
      if(jsonObj[key].includes("--template")){
        var templatePath = jsonObj[key].substring(jsonObj[key].indexOf(" ") + 1);
        templatePath = path.join(inputPath,templatePath);
        debugHTMLOptions("template added: " + templatePath);
        cliArgs += " --template " + templatePath;
      } else if(jsonObj[key].includes("-c ")){
        var ccsPath = jsonObj[key].substring(jsonObj[key].indexOf(" ") + 1);
        ccsPath = path.join(inputPath,ccsPath); 
        debugHTMLOptions("css added: " + ccsPath);
        cliArgs += " -c " +ccsPath;
      } else if(jsonObj[key].includes("-o")){
        debugHTMLOptions("Arg [ -o ] cannot be changed. Ignoring.");
      } else {
        debugHTMLOptions("Arg [ "+jsonObj[key]+" ] added.");
        cliArgs += " " + jsonObj[key];
      }
    }
  } else {
    debugHTML("No pandoc Args given in manifest. Using default arguments: '" + cliArgs + "'");
  }
  return cliArgs;
}

function buildWkhtmltopdfOptions(optionsJson, fileName){
  debugPDF("Adding wkhtmltopdf options from Manifest");
  var defaultOptions = {
    output: fileName,
    enableLocalFileAccess: true,
    disableSmartShrinking: true,
    marginBottom: "1in",
    marginTop: "1in",
    marginLeft: ".7in",
    marginRight: ".7in",
    pageSize: "Letter",
    footerLine: true,
    footerCenter: "Page [page]"
  };
  var finalOptions = defaultOptions;
  if(optionsJson){
    for (var key in optionsJson){
      if(key == "enableLocalFileAccess" ||
          key == "disableSmartShrinking" ||
          key == "output"){
        debugPDFOptions("Option [ "+key+" ] cannot be changed for output. Ignoring.");
      } else {
        debugPDFOptions("Updating ["+key+"] to: " + optionsJson[key]);
        finalOptions[key] = optionsJson[key];
      } 
    }
    return finalOptions;
  }
  debugPDF("No options given in manifest. Using Default wkhtmltopdf options.");
  return finalOptions;
}

function renameToManifestOutputName(manifestJson, absInputFile, mode){
  console.log(" Renaming "+path.parse(absInputFile).base+"...");
  var title = path.parse(manifestJson.output.name).name;
  var absOutput = path.parse(absInputFile).dir;
  if(mode == MODE.pdf){
    absOutput = path.join(absOutput, title + EXT.pdf);
  }
  if(mode == MODE.html){
    absOutput = path.join(absOutput, title + EXT.html);
  }
  fs.rename(absInputFile, absOutput,  () => {
    var manifestOutputDir = path.parse(manifestJson.output.name).dir;
    var mOutput = path.join(manifestOutputDir,path.parse(absOutput).base);
    console.log(mOutput + " created.");
  });
}

exports.build = build;