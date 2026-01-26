const manifestUtil = require("./manifest.js");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const { promisify } = require("util");
const { execFile } = require("child_process");
const execFileAsync = promisify(execFile);
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

async function build(inputFile, outputFormat, manifestFileStr) {
  if (!outputFormat) return inputFile;

  console.log("\n📄 Converting to " + outputFormat + "...");
  
  const manifest = manifestUtil.getJSON_withABSPaths(manifestFileStr);
  const manifestOutputName = manifest.output.name;
  const manifestOutputPandoc = manifest.output.pandoc;
  const manifestOutputWkhtmltopdf = manifest.output.wkhtmltopdf;

  const fileNames = [];
  const generatedFiles = path.parse(inputFile);
  for (const ext in EXTS) {
    const fileName = path.join(generatedFiles.dir, `${generatedFiles.name}${ext}`);
    fileNames.push(fileName);
  }
  debug(`deleteGeneratedFiles: ${JSON.stringify(fileNames)}`);
  deleteGeneratedFiles(fileNames);

  const pandocOutputExt = outputFormat.includes(EXTS.docx) ? EXTS.docx : EXTS.html;
  const resultPandocFile = await pandocWriteToFile(inputFile, manifestOutputPandoc, pandocOutputExt);
  
  if (outputFormat.includes(EXTS.pdf)) {
    const inputFileParsed = path.parse(inputFile);
    const pdfFileName = path.join(inputFileParsed.dir, `${inputFileParsed.name}${EXTS.pdf}`);
    return await wkhtmltopdfWriteToFile(resultPandocFile, manifestOutputWkhtmltopdf, pdfFileName);
  } else {
    const outputNewName = `${path.parse(manifestOutputName).name}${pandocOutputExt}`;
    const outputPath = path.parse(resultPandocFile).dir;
    const outputFile = path.join(outputPath, outputNewName);
    debug(`${path.parse(resultPandocFile).base} >>  ${outputNewName}`);
    
    try {
      await fsPromises.rename(resultPandocFile, outputFile);
      return outputFile;
    } catch (err) {
      console.error("\n❌ Error renaming output file:");
      console.error("   " + err.message);
      throw err;
    }
  }
}

// Input and Output files are expected to be ABS
async function pandocWriteToFile(inputFile, pandocParams, outputExt) {
  debug(`Creating ${outputExt} using Pandoc...`);
  const outputFile = path.join(path.parse(inputFile).dir, `temp${outputExt}`);
  const pandocArgs = buildPandocArgsArray(pandocParams, outputFile);
  debugPandoc("input: " + inputFile);
  debugPandoc("Args: " + JSON.stringify(pandocArgs));
  
  try {
    const { stderr } = await execFileAsync("pandoc", [inputFile, ...pandocArgs]);
    
    // Show any warnings even on success
    if (stderr && stderr.trim()) {
      const warningMsg = stderr.trim();
      console.log("   ⚠ " + warningMsg.split("\n")[0]);
      debugPandoc("Full output: " + warningMsg);
    }
    console.log("   ✓ Generated " + path.parse(outputFile).base);
    return outputFile;
  } catch (err) {
    // Check if output file was created despite error/warning
    if (fs.existsSync(outputFile)) {
      // File created successfully, stderr was just a warning
      if (err.stderr) {
        const warningMsg = err.stderr.trim();
        if (warningMsg) {
          console.log("   ⚠ Pandoc warning: " + warningMsg.split("\n")[0]);
          debugPandoc("Full warning: " + warningMsg);
        }
      }
      console.log("   ✓ Generated " + path.parse(outputFile).base);
      return outputFile;
    } else {
      // Real error - file not created
      console.error("\n❌ Pandoc error:");
      if (err.code === "ENOENT") {
        console.error("   Pandoc not found. Make sure it's installed and in your PATH");
        console.error("   Install: https://pandoc.org/installing.html");
      } else {
        console.error("   " + (err.stderr ? err.stderr.trim() : err.message));
        console.error("   Docs: https://pandoc.org/MANUAL.html");
      }
      throw err;
    }
  }
}

// Input and Output files are expected to be ABS
function wkhtmltopdfWriteToFile(inputFile, wkhtmltopdfParams, outputFile) {
  debug("Creating PDF using wkhtmltopdf...");
  var options = buildWkhtmltopdfOptions(wkhtmltopdfParams, outputFile);
  debugWkhtmltopdf("input: " + inputFile);
  debugWkhtmltopdf("Args: " + JSON.stringify(options, null, 2));
  return new Promise((resolve, reject) => {
    wkhtmltopdf(fs.createReadStream(inputFile), options, function (err) {
      if (err) {
        const errMsg = err.toString();
        console.error("\n❌ wkhtmltopdf error:");
        
        if (errMsg.includes("spawn wkhtmltopdf ENOENT")) {
          console.error("   wkhtmltopdf not found. Make sure it's installed and in your PATH");
          console.error("   Install: http://wkhtmltopdf.org/downloads.html");
        } else if (errMsg.includes("EACCES")) {
          console.error("   Permission denied accessing file");
          console.error("   " + errMsg);
        } else if (errMsg.includes("Exit with code")) {
          // wkhtmltopdf returned non-zero exit code
          const lines = errMsg.split("\n").filter(l => l.trim());
          console.error("   " + lines[0]);
          if (lines.length > 1) {
            lines.slice(1, 4).forEach(line => console.error("   " + line));
          }
          console.error("   Docs: http://wkhtmltopdf.org/usage/wkhtmltopdf.txt");
        } else {
          console.error("   " + errMsg.split("\n")[0]);
          console.error("   Docs: http://wkhtmltopdf.org/usage/wkhtmltopdf.txt");
        }
        
        reject(err);
      } else {
        console.log("   ✓ Generated " + path.parse(outputFile).base);
        resolve(outputFile);
      }
    });
  });
}

function buildPandocArgsArray(params, fileName) {
  // Build args as array for execFile
  // Don't use --quiet so we can see useful warnings
  var argsArray = ["-o", fileName];
  debugPandocDefaults("Base args: " + JSON.stringify(argsArray));
  
  if (params) {
    for (var key in params) {
      const paramValue = params[key].trim();
      if (paramValue.includes("-o")) {
        debugPandocOptions("Arg [ -o ] cannot be changed. Ignoring.");
      } else {
        debugPandocOptions("Arg added: " + paramValue);
        // Split args that have spaces (e.g., "-c mystyle.css" becomes ["-c", "mystyle.css"])
        const splitArgs = paramValue.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        argsArray.push(...splitArgs.map(arg => arg.replace(/^"(.*)"$/, "$1")));
      }
    }
  } else {
    debugPandoc("No pandoc Args given in manifest. Using defaults.");
  }
  
  debugPandocOptions("Final Args: " + JSON.stringify(argsArray));
  return argsArray;
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