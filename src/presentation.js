const manifestUtil = require("./manifest.js");
const fs = require("fs");
const path = require("path");
const nodePandoc = require("node-pandoc");
const wkhtmltopdf = require("wkhtmltopdf");
const debug = require("debug")("presentation");
const debugPandoc = require("debug")("pandoc");
const debugPandocOptions = require("debug")("pandoc:options");
const debugPandocDefaults = require("debug")("pandoc:options:defaults");
const debugWkhtmltopdf = require("debug")("pdf");
const debugWkhtmltopdfOptions = require("debug")("pdf:options");
const debugPdfDefaults = require("debug")("pdf:options:defaults");
exports.debbugOptions = {
  "presentation": "",
  "html": "pandoc messages for html",
  "html:options": "pandoc options messages",
  "pdf": "wkhtmltopdf messages for pdf",
  "pdf:options": "wkhtmltopdf options messages"
};

const EXTS = {
  pdf: ".pdf",
  html: ".html",
  docx: ".docx"
};
exports.EXTS = EXTS;

var build = async function (inputFile, outputFormat, manifestFileStr) {
  if(!outputFormat) return inputFile;

  console.log(outputFormat + " format selected for " + path.parse(inputFile).base);
  console.log("+++++++++++++");
  
  let manifest = manifestUtil.getJSON_withABSPaths(manifestFileStr);
  const manifestOutputName = manifest.output.name;
  const manifestOutputPandoc = manifest.output.pandoc;
  const manifestOutputWkhtmltopdf = manifest.output.wkhtmltopdf;

  const fileNames = [];
  var generatedFiles = path.parse(inputFile);
  for (const ext in EXTS) {
    const fileName = path.join(generatedFiles.dir,`${generatedFiles.name}${ext}`);
    fileNames.push(fileName);
  }
  debug(`deleteGeneratedFiles: ${JSON.stringify(fileNames)}`);
  deleteGeneratedFiles(fileNames);

  return new Promise((resolve, reject) => {

    let pandocOutputFormat = EXTS.html; //required for html and pdf output
    if(outputFormat.includes(EXTS.docx)) {
      pandocOutputFormat = EXTS.docx;
    }

    pandocWriteToFile(inputFile, manifestOutputPandoc, pandocOutputFormat)
      .then(resultPandocFile => {
        if (outputFormat.includes(EXTS.pdf)) {
          const pdfFileName = path.join(parsed.dir, `${parsed.name}${EXTS.pdf}`);
          wkhtmltopdfWriteToFile(resultPandocFile, manifestOutputWkhtmltopdf, pdfFileName)
            .then(resultPdfFile => {
              resolve(resultPdfFile);
            });
        } else {
          var outputNewName = path.parse(manifestOutputName).name + "." + pandocOutputFormat;
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
function pandocWriteToFile(inputFile, pandocParams, outputFormat) {
  debug("Creating HTML using Pandoc...");
  var outputFile = path.join(path.parse(inputFile).dir, `temp.${outputFormat}`);
  var pandocArgs = buildPandocArgs(pandocParams, outputFile);
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

function buildPandocArgs(params, fileName) {
  var cliArgs = "-o " + fileName;
  debugPandocDefaults(cliArgs);
  if (params) {
    for (var key in params) {
      if (params[key].includes("-o")) {
        debugPandocOptions("Arg [ -o ] cannot be changed. Ignoring.");
      } else {
        debugPandocOptions("Arg added: " + params[key]);
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
  debugPdfDefaults(defaultOptions);
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

function deleteGeneratedFiles(fileArray) {
  fileArray.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      debug("Deleting: " + filePath);
      fs.unlinkSync(filePath);
    }
  });
}

exports.build = build;