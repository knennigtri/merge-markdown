const manifestUtil = require("./manifest.js");
const fs = require("fs");
const path = require("path");
const nodePandoc = require("node-pandoc");
const wkhtmltopdf = require("wkhtmltopdf");
const debug = require("debug")("presentation");
const debugPandoc = require("debug")("pandoc");
const debugPandocOptions = require("debug")("pandoc:options");
const debugWkhtmltopdf = require("debug")("pdf");
const debugWkhtmltopdfOptions = require("debug")("pdf:options");
const debugDefaults = require("debug")("defaults");
const OUTPUT_FORMAT = {
  "pdf": "pdf",
  "html": "html",
  "word": "docx" //TODO implement word output
};

exports.OUTPUT_FORMAT = OUTPUT_FORMAT;
exports.debbugOptions = {
  "presentation": "",
  "html": "pandoc messages for html",
  "html:options": "pandoc options messages",
  "pdf": "wkhtmltopdf messages for pdf",
  "pdf:options": "wkhtmltopdf options messages"
};

var build = async function (inputFile, outputFormat, manifestFile) {
  if(!outputFormat) return inputFile;

  console.log(outputFormat + " format selected for " + path.parse(inputFile).base);
  console.log("+++++++++++++");
  
  let manifestObj = manifestUtil.getManifestObj(manifestFile); //TODO implement getJSON_withABSPaths()
  let manifestPath = path.dirname(path.resolve(manifestFile));

  const fileNames = {};
  var parsed = path.parse(inputFile);
  for (const key in OUTPUT_FORMAT) {
    if (key in OUTPUT_FORMAT) {
      const ext = OUTPUT_FORMAT[key];
      const fileName = path.join(parsed.dir,parsed.name + "." + ext);
      fileNames[key] = fileName;
    }
  }
  deleteGeneratedFiles(fileNames);

  return new Promise((resolve, reject) => {

    let pandocOutputFormat = OUTPUT_FORMAT.html; //required for html and pdf output
    if(outputFormat == OUTPUT_FORMAT.word) {
      pandocOutputFormat = outputFormat;
    }

    pandocWriteToFile(inputFile, manifestObj.output.pandoc, manifestPath, pandocOutputFormat)
      .then(resultPandocFile => {
        if (outputFormat == OUTPUT_FORMAT.pdf) {
          wkhtmltopdfWriteToFile(resultPandocFile, manifestObj.output.wkhtmltopdf, fileNames.pdf)
            .then(resultPdfFile => {
              resolve(resultPdfFile);
            });
        } else {
          var outputNewName = path.parse(manifestObj.output.name).name + "." + pandocOutputFormat;
          var outputPath = path.parse(resultPandocFile).dir;
          var outputFile = path.join(outputPath, outputNewName);
          debug(`temp.${pandocOutputFormat} >>  ${outputNewName}`);
          fs.rename(resultPandocFile, outputFile, () => {
            resolve(outputFile);
          });
        }
      });
  });
};

// Input and Output files are expected to be ABS
function pandocWriteToFile(inputFile, pandocParams, manifestPath, outputFormat) {
  debug("Creating HTML using Pandoc...");
  var outputFile = path.join(path.parse(inputFile).dir, `temp.${outputFormat}`);
  var pandocArgs = buildPandocArgs(pandocParams, outputFile, manifestPath);
  debugPandoc("input: " + inputFile);
  debugPandoc("Args: '" + pandocArgs + "'");
  return new Promise((resolve, reject) => {
    nodePandoc(inputFile, pandocArgs, (err) => {
      if (err) {
        console.error("Verify the pandoc arguments according to pandoc documentation");
        console.error("Make sure pandoc is installed! https://pandoc.org/installing.html");
        reject(err);
      }
      console.log(" pandoc: " + path.parse(inputFile).base + " >> " + path.parse(outputFile).base);
      resolve(outputFile);
    });
  });
}

// Input and Output files are expected to be ABS
function wkhtmltopdfWriteToFile(inputFile, wkhtmltopdfParams, outputFile) {
  debug("Creating PDF using wkhtmltopdf...");
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
      if (params[key].includes("--template") && fileName.includes("html")) { //ability to include a template for html output
        var templatePath = params[key].substring(params[key].indexOf(" ") + 1);
        templatePath = path.join(inputPath, templatePath);
        debugPandocOptions("template added: " + templatePath);
        cliArgs += " --template " + templatePath;
      } else if (params[key].includes("--reference-doc") && fileName.includes("docx")) { //ability to include a reference doc for docx output
        var referenceDocPath = params[key].substring(params[key].indexOf(" ") + 1);
        referenceDocPath = path.join(inputPath, referenceDocPath);
        debugPandocOptions("reference doc added: " + referenceDocPath);
        cliArgs += " --reference-doc " + referenceDocPath;
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
    debugPandoc("No pandoc Args given in manifest. Using defaults.");
  }
  debugPandocOptions("Final Args: " + cliArgs);
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
    debugWkhtmltopdfOptions("Final Args: " + finalOptions);
    return finalOptions;
  }
  debugWkhtmltopdf("No options given in manifest. Using Default wkhtmltopdf options.");
  return finalOptions;
}

function deleteGeneratedFiles(fileObj) {
  for (const key in fileObj) {
    if (key in fileObj) {
      const filePath = fileObj[key];
      if (fs.existsSync(filePath)) {
        debug("Deleting: " + filePath);
        fs.unlinkSync(filePath);
      }
    }
  }
}

exports.build = build;