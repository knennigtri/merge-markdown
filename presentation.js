var path = require("path");
var nodePandoc = require("node-pandoc");
var wkhtmltopdf = require("wkhtmltopdf");
var debug = require("debug")("presentation");
var debugPandoc = require("debug")("html");
var debugPandocOptions = require("debug")("html:options");
var debugWkhtmltopdf = require("debug")("pdf");
var debugWkhtmltopdfOptions = require("debug")("pdf:options");
var debugDefaults = require("debug")("defaults")
var fs = require("fs");
var MODE = {
  "pdf": "pdf",
  "html": "html"
};

exports.MODE = MODE;
exports.debbugOptions = {
  "presentation": "",
  "html": "pandoc messages for html",
  "html:options": "pandoc options messages",
  "pdf": "wkhtmltopdf messages for pdf",
  "pdf:options": "wkhtmltopdf options messages"
};

var build = async function (jsonObj, inputPath, mode) {
  console.log("Creating presentation...");
  debug("Presentation output: " + mode);
  var absInputPath = path.resolve(inputPath);
  debug("Input: " + absInputPath);

  //Set the output location of documents
  var absManifestOutputPath = path.parse(jsonObj.output.name).dir;
  var absManifestOutputFileName = path.parse(jsonObj.output.name).base;
  var absOutputPath = path.join(absInputPath, absManifestOutputPath);
  //Location of merge-markdown file
  var absMMFileName = path.join(absOutputPath, absManifestOutputFileName);

  console.log(mode.toUpperCase() + " mode selected for " + absManifestOutputFileName);
  console.log("+++++++++++++");
  pandocWriteToFile(absMMFileName, jsonObj.output.pandoc, absInputPath)
    .then(resultHtmlFile => {
      if (mode == MODE.pdf) {
        return wkhtmltopdfWriteToFile(resultHtmlFile, jsonObj.output.wkhtmltopdf)
          .then(resultPdfFile => {
            return resultPdfFile;
          });
      } else {
        return resultHtmlFile;
      }
    }).then((resultFileToRename) => {
      renameToManifestOutputName(resultFileToRename, jsonObj.output.name, mode);
    });
};

// Input and Output files are expected to be ABS
function pandocWriteToFile(inputFile, pandocParams, inputPath) {
  debug("Creating HTML using Pandoc...");
  var outputFile = path.join(path.parse(inputFile).dir, "temp.html"); //TODO might be failing for windows
  var pandocArgs = buildPandocArgs(pandocParams, outputFile, inputPath);
  debugPandoc("input: " + inputFile);
  debugPandoc("Args: '" + pandocArgs + "'");
  return new Promise((resolve, reject) => {
    nodePandoc(inputFile, pandocArgs, function (err, result) {
      if (err) {
        console.error("Verify the pandoc arguments according to pandoc documentation");
        console.error("Make sure pandoc is installed! https://pandoc.org/installing.html")
        reject(err);
      }
      console.log(" pandoc: " + path.parse(inputFile).base + " >> " + path.parse(outputFile).base);
      resolve(outputFile);
    });
  });
}

// Input and Output files are expected to be ABS
function wkhtmltopdfWriteToFile(inputFile, wkhtmltopdfParams) {
  debug("Creating PDF using wkhtmltopdf...");
  var outputFile = path.join(path.parse(inputFile).dir, "temp.pdf");
  var options = buildWkhtmltopdfOptions(wkhtmltopdfParams, outputFile);
  debugWkhtmltopdf("input: " + inputFile);
  debugWkhtmltopdf("Args: " + JSON.stringify(options, null, 2));
  return new Promise((resolve, reject) => {
    wkhtmltopdf(fs.createReadStream(inputFile), options, function (err, result) {
      if (err) {
        if (err.toString().includes("spawn wkhtmltopdf ENOENT")) console.error("Make sure wkhtmltopdf is installed! http://wkhtmltopdf.org/downloads.html");
        else console.error("Verify the wkhtmltopdf options according to wkhtmltopdf documentation");
        reject(err);
      } else {
        console.log("wkhtmltopdf: " + path.parse(inputFile).base + " >> " + path.parse(outputFile).base);
        resolve(outputFile);
      }
    });
  });
}

function buildPandocArgs(params, fileName, inputPath) {
  var cliArgs = "-o " + fileName;
  debugDefaults("Defaults for pandoc:");
  debugDefaults(cliArgs);
  if (params) {
    for (var key in params) {
      if (params[key].includes("--template")) {
        var templatePath = params[key].substring(params[key].indexOf(" ") + 1);
        templatePath = path.join(inputPath, templatePath);
        debugPandocOptions("template added: " + templatePath);
        cliArgs += " --template " + templatePath;
      } else if (params[key].includes("-c ")) {
        var ccsPath = params[key].substring(params[key].indexOf(" ") + 1);
        ccsPath = path.join(inputPath, ccsPath);
        debugPandocOptions("css added: " + ccsPath);
        cliArgs += " -c " + ccsPath;
      } else if (params[key].includes("-o")) {
        debugPandocOptions("Arg [ -o ] cannot be changed. Ignoring.");
      } else {
        debugPandocOptions("Arg [ " + params[key] + " ] added.");
        cliArgs += " " + params[key];
      }
    }
  } else {
    debugWkhtmltopdf("No pandoc Args given in manifest. Using defaults.");
  }
  return cliArgs;
}

function buildWkhtmltopdfOptions(params, fileName) {
  debugWkhtmltopdf("Adding wkhtmltopdf options from Manifest");
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
  debugDefaults("Defaults for wkhtmltopdf:");
  debugDefaults(defaultOptions);
  var finalOptions = defaultOptions;
  if (params) {
    for (var key in params) {
      if (key == "enableLocalFileAccess" ||
        key == "disableSmartShrinking" ||
        key == "output") {
        debugWkhtmltopdfOptions("Option [ " + key + " ] cannot be changed for output. Ignoring.");
      } else {
        debugWkhtmltopdfOptions("Updating [" + key + "] to: " + params[key]);
        finalOptions[key] = params[key];
      }
    }
    return finalOptions;
  }
  debugWkhtmltopdf("No options given in manifest. Using Default wkhtmltopdf options.");
  return finalOptions;
}

function renameToManifestOutputName(absInputFile, outputFile, extension) {
  console.log(" Renaming " + path.parse(absInputFile).base + "...");
  var outputTitle = path.parse(outputFile).name;
  var absInputPath = path.parse(absInputFile).dir;

  var absOutput = path.join(absInputPath, outputTitle + "." + extension);

  fs.rename(absInputFile, absOutput, () => {
    var manifestOutputDir = path.parse(outputFile).dir;
    var mOutput = path.join(manifestOutputDir, path.parse(absOutput).base);
    console.log(mOutput + " created.");
  });
}

exports.build = build;