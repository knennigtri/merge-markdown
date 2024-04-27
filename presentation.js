const manifestUtil = require("./manifest.js");
const fs = require("fs");
const path = require("path");
const nodePandoc = require("node-pandoc");
const wkhtmltopdf = require("wkhtmltopdf");
const debug = require("debug")("presentation");
const debugPandoc = require("debug")("html");
const debugPandocOptions = require("debug")("html:options");
const debugWkhtmltopdf = require("debug")("pdf");
const debugWkhtmltopdfOptions = require("debug")("pdf:options");
const debugDefaults = require("debug")("defaults")
const MODE = {
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

var build = async function (inputFile, mode, manifestFile) {
  if((mode != MODE.pdf) && (mode != MODE.html)) return inputFile;

  console.log(mode.toUpperCase() + " mode selected for " + path.parse(inputFile).base);
  console.log("+++++++++++++");
  
  let manifestObj = manifestUtil.getManifestObj(manifestFile);
  let manifestPath = path.dirname(path.resolve(manifestFile));

  const fileNames = {};
  var parsed = path.parse(inputFile)
  for (const key in MODE) {
    if (MODE.hasOwnProperty(key)) {
      const ext = MODE[key];
      const fileName = path.join(parsed.dir,parsed.name + "." + ext);
      fileNames[key] = fileName;
    }
  }
  deleteGeneratedFiles(fileNames);

  return new Promise((resolve, reject) => {
    pandocWriteToFile(inputFile, manifestObj.output.pandoc, manifestPath)
      .then(resultHtmlFile => {
        if (mode == MODE.pdf) {
          wkhtmltopdfWriteToFile(resultHtmlFile, manifestObj.output.wkhtmltopdf, fileNames.pdf)
            .then(resultPdfFile => {
              resolve(resultPdfFile);
            });
        } else {
          var outputNewName = path.parse(manifestObj.output.name).name + ".html";
          var outputPath = path.parse(resultHtmlFile).dir;
          var outputFile = path.join(outputPath, outputNewName);
          debug("temp.html >> " + outputNewName);
          fs.rename(resultHtmlFile, outputFile, () => {
            resolve(outputFile);
          });
        }
      });
  });
};

// Input and Output files are expected to be ABS
function pandocWriteToFile(inputFile, pandocParams, manifestPath) {
  debug("Creating HTML using Pandoc...");
  var outputFile = path.join(path.parse(inputFile).dir, "temp.html");
  var pandocArgs = buildPandocArgs(pandocParams, outputFile, manifestPath);
  debugPandoc("input: " + inputFile);
  debugPandoc("Args: '" + pandocArgs + "'");
  return new Promise((resolve, reject) => {
    nodePandoc(inputFile, pandocArgs, (err) => {
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
    debugPandoc("No pandoc Args given in manifest. Using defaults.");
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

function deleteGeneratedFiles(fileObj) {
  for (const key in fileObj) {
    if (fileObj.hasOwnProperty(key)) {
      const filePath = fileObj[key];
      if (fs.existsSync(filePath)) {
        console.log("Deleting: " + filePath);
        fs.unlinkSync(filePath);
      }
    }
  }
}

exports.build = build;