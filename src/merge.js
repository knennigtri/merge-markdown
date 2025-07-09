const manifestUtil = require("./manifest.js");
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");
const concat = require("concat");
const markdownLinkCheck = require("markdown-link-check");
const doctoc = require("doctoc/lib/transform");
const validUrl = require("valid-url");
const debug = require("debug")("merge");
const debugRelLinks = require("debug")("rellinks");
const debugYaml = require("debug")("o:yaml");
const debugDoctoc = require("debug")("o:doctoc");
const debugReplace = require("debug")("o:replace");
const debugLinkcheck = require("debug")("linkcheck");
const debugLinkcheckDeep = require("debug")("linkcheck:deep");
const EXT = {
  "linkcheck": ".linkcheck.md",
  "qa": ".qa.md"
};
// RM exports.EXT = EXT;
exports.debbugOptions = {
  "merge": "messages for merge process",
  "rellinks": "relative links",
  "o:yaml": "yaml removal",
  "o:doctoc": "doctoc messages",
  "o:replace": "regex replace messages",
  "linkcheck": "linkcheck validation",
  "linkcheck:deep": "deep linkcheck validation",
};

function start(manifestFile, qaMode, skip_linkcheck, maintainAssetPaths) {
  var onlyQA = qaMode || false;
  var skipLinkcheck = skip_linkcheck || false;
  var keepAssetPaths = maintainAssetPaths || false;

  //Set manifest variables
  const manifest = manifestUtil.getJSON_withABSPaths(manifestFile, onlyQA);
  var manifestOutputName = manifest.output.name;
  var manifestInput = manifest.input;
  var manifestQARegEx;
  if (manifest.qa) manifestQARegEx = new RegExp(manifest.qa.exclude);
  
  if (onlyQA) console.log("QA exclude regex: " + manifestQARegEx);

  if (skipLinkcheck) console.log("Skipping linkcheck on all files");

  //removes old .md files
  deleteGeneratedFiles([
    manifestOutputName,
    replaceExtension(manifestOutputName, EXT.linkcheck),
    replaceExtension(manifestOutputName, EXT.qa)
  ]);

  //Iterate through all of the input files in manifest apply options
  var fileArr = [];
  var refFileArr = [];
  Object.keys(manifestInput).forEach(function (inputKey) {
    var inputFileName = path.basename(inputKey);
    console.log("--" + inputFileName + "--");
    if (onlyQA && manifestQARegEx.test(inputFileName)) {
      console.log("Skipping " + inputFileName + " for QA");
      return;
    }
    if (!fs.existsSync(inputKey)) {
      console.log(inputFileName + " does not exist. Skipping.");
      return;
    }
    var origContent = fs.readFileSync(inputKey, "utf-8");

    //Force a new line at the end of the file to help with file merging
    origContent += "\n";
    origContent += "";

    //updates all relative asset paths to the relative output location
    var generatedContent = updateAssetRelPaths(origContent, path.dirname(inputKey), path.dirname(manifestOutputName), keepAssetPaths);

    debug("--Apply file OPTIONS--");
    //Content, local options, global options
    generatedContent = applyContentOptions(generatedContent, manifestInput[inputKey], manifest);

    var tempFile = inputKey + ".temp";
    fs.writeFileSync(tempFile, generatedContent);

    if (!skipLinkcheck) {
      //checks for broken links within the content
      debug("--Create/Update linkcheck file--");
      linkcheck(tempFile, replaceExtension(manifestOutputName, EXT.linkcheck));
    }

    //add the  temp file to the list to merge together
    fileArr.push(tempFile);
    debug(path.basename(tempFile));
    console.log("...added to merge list");
  });

  console.log("+++++++++++++");
  //Merge lists and output single markdown file
  var mergedFileArr = fileArr.concat(refFileArr);

  console.log("Creating Merged Markdown:\n " + mergedFileArr.join("\n "));
  var fileToWrite = manifestOutputName;
  if (onlyQA) {
    fileToWrite = replaceExtension(fileToWrite, EXT.qa);
  }
  return createSingleFile(mergedFileArr, fileToWrite, manifest);
}

async function createSingleFile(list, fileToWrite, manifestJSON) {
  debug("Creating single file");
  if (!list || list.length === 0) {
    console.log("List to merge is not valid. Aborting..");
    return Promise.reject(new Error("Invalid list"));
  }
  return concat(list).then((resultContent) => {
    if (Object.prototype.hasOwnProperty.call(manifestJSON.output, "doctoc") && manifestJSON.output.doctoc) {
      manifestJSON.output.doctoc;
      var outDoctoc = optionBuildTOC(resultContent, manifestJSON.output.doctoc, manifestJSON.doctoc);
      return safelyWriteFile(fileToWrite, outDoctoc);
    } else {
      return safelyWriteFile(fileToWrite, resultContent);
    }
  }).then((result) => {
    deleteGeneratedFiles(list); //cleanup
    return result;
  });
}

//Content, local options, global options
function applyContentOptions(origContent, fileOptions, globalOptions) {
  var scrubbedContent = origContent;

  // if(fileOptions == undefined || fileOptions == "") return scrubbedContent;

  /* Apply noYAML */
  //Apply local noYAML option
  if (fileOptions && Object.prototype.hasOwnProperty.call(fileOptions, "noYAML")) {
    if (fileOptions.noYAML) {
      debug("Using [Local] noYAML...");
      scrubbedContent = optionRemoveYAML(origContent);
    }
  } else //Apply global noYAML option
    if (Object.prototype.hasOwnProperty.call(globalOptions, "noYAML") && globalOptions.noYAML) {
      debug("Using [Global] noYAML...");
      scrubbedContent = optionRemoveYAML(origContent);
    }

  /* Apply find and replace */
  //Apply local replace
  if (fileOptions && Object.prototype.hasOwnProperty.call(fileOptions, "replace")) {
    // merge global replace with local replace taking precedence
    if (Object.prototype.hasOwnProperty.call(globalOptions, "replace")) {
      for (var key in globalOptions.replace) {
        if (!Object.prototype.hasOwnProperty.call(fileOptions.replace, key)) {
          fileOptions.replace[key] = globalOptions.replace[key];
        }
      }
      debug("Using [Local/Global] Find/Replace...");
      scrubbedContent = optionReplaceStrings(scrubbedContent, fileOptions.replace);
    } else {
      debug("Using [Local] Find/Replace...");
      scrubbedContent = optionReplaceStrings(scrubbedContent, fileOptions.replace);
    }
  } else //Apply global replace
    if (Object.prototype.hasOwnProperty.call(globalOptions, "replace")) {
      debug("Using [Global] Find/Replace...");
      scrubbedContent = optionReplaceStrings(scrubbedContent, globalOptions.replace);
    }

  //Add TOC
  if (fileOptions && Object.prototype.hasOwnProperty.call(fileOptions, "doctoc")) {
    if (fileOptions.doctoc) {
      if (Object.prototype.hasOwnProperty.call(globalOptions, "doctoc")) {
        debugDoctoc("Using [Local/Global] DocToc...");
        scrubbedContent = optionBuildTOC(scrubbedContent, fileOptions.doctoc, globalOptions.doctoc);
      } else {
        debugDoctoc("Using [Local] DocToc...");
        scrubbedContent = optionBuildTOC(scrubbedContent, fileOptions.doctoc);
      }
    }
  } else if (Object.prototype.hasOwnProperty.call(globalOptions, "doctoc") && globalOptions.doctoc) {
    debug("Using [Global] DocToc...");
    scrubbedContent = optionBuildTOC(scrubbedContent, null, globalOptions.doctoc);
  }

  return scrubbedContent;
}

/** Searches for ![*](relPath) or src="relPath" in a string and replaces the asset
 * relPath with an absolute one
 */
function updateAssetRelPaths(fileContents, inputFilePath, mergedFilePath, keepAssetPaths) {
  var resultContent = [];
  var regex = /(!\[(.*?)\][(](.*?)[)])|(src=[""](.*?)[""])/g;
  debug("Rewriting Relative Asset Paths");
  debugRelLinks("inputFilePath: " + inputFilePath);
  debugRelLinks("mergedFilePath: " + mergedFilePath);
  //Go through each line that and 
  var lines = fileContents.split("\n");
  var count = 0;
  lines.forEach((line, lineNumber) => {
    var match = line.match(regex);
    var origAssetPath = "";
    //if found capture relPath
    if (match != null) {
      var origStr = match[0];
      //Example: ![my-asset](links/my-asset.jpg)
      if (origStr.startsWith("![")) {
        origAssetPath = origStr.substring(origStr.indexOf("(") + 1, origStr.indexOf(")"));
      } else {
        //Example: src="links/my-asset.jpg"
        if (origStr.startsWith("src=")) {
          origAssetPath = origStr.substring(origStr.indexOf("\"") + 1, origStr.lastIndexOf("\""));
        }
      }
      //Check if path is a URL
      if (!validUrl.isUri(origAssetPath)) {
        var newAssetPath = "";
        //patch for issue #51
        if (path.isAbsolute(origAssetPath)) {
          debugRelLinks("OrigPath");
          newAssetPath = origAssetPath;
        } else {
          //resolve the asset path
          newAssetPath = path.resolve(inputFilePath, origAssetPath);
          if (keepAssetPaths) {
            debugRelLinks("relPath");
            newAssetPath = path.relative(mergedFilePath, newAssetPath);
          }
        }

        count++;
        debugRelLinks("[Line " + lineNumber + "]: " + origAssetPath);
        debugRelLinks("Updated to: " + newAssetPath);

        var newLine = line.replace(origAssetPath, newAssetPath);
        resultContent.push(newLine);
      } else {
        resultContent.push(line);
      }
    } else {
      resultContent.push(line);
    }
  });
  debugRelLinks(count + " relative paths updated");
  return resultContent.join("\n");
}

/** Removes the YAML at the top of a markdown file
 * @param {*} fileContents String that might contain YAML
 * @returns String that has YAML removed
 */
function optionRemoveYAML(fileContents) {
  debug("[OPTION] Remove YAML...");
  var resultContent = fileContents;
  var lines = fileContents.split("\n");
  var i = 0;
  var startYAML = -1;
  var endYAML = -1;
  for (i = 0; i < lines.length; i++) {
    var line = lines[i];
    //Stop searching if there is no YAML
    if (i == 0 && line != "---") {
      break;
    }
    //Set start/end YAML indexes if they are available
    if (i == 0 && startYAML == -1 && line == "---") {
      startYAML = i;
    } else if (startYAML != -1 && endYAML == -1 && line == "---") {
      endYAML = i;
      break;
    }//TODO YAML is on line 2 or (\n\r before YAML..)

    //Stop searching if a header # is reached
    if (startYAML != -1 && line.startsWith("#")) {
      break;
    }
  }
  debugYaml("S(" + startYAML + ")E(" + endYAML + ")✓ d(" + i + ")T(" + lines.length + ")");
  if (startYAML != -1 && endYAML != -1) {
    //shows YAML being removed
    debugYaml("Removing S(" + startYAML + ")->E(" + endYAML + ") YAML:");
    var yaml = lines.splice(startYAML, 1 + endYAML - startYAML).join("\n");
    debugYaml(yaml);
    resultContent = lines.join("\n");
    debugYaml("YAML removed");
  } else {
    debugYaml("No YAML found for removal");
  }
  return resultContent;
}

/** Replaces any value with another value. 
 * Regex values are allowed and will be wrapped with /str/g
 * Debug=merge:replace
 */
function optionReplaceStrings(fileContents, replacements) {
  debug("[OPTION] Find and Replace Strings...");
  var replacedContent = fileContents;
  Object.keys(replacements).forEach(function (replaceKey) {
    var findRegex = "";
    findRegex = new RegExp(replaceKey, "g");
    var replaceStr = replacements[replaceKey];
    debugReplace("Replacing: " + findRegex + " with: " + replaceStr);
    replacedContent = replacedContent.replace(findRegex, replaceStr);
  });
  return replacedContent;
}

/*

*/
function optionBuildTOC(fileContents, doctocLocal, doctocGlobal) {
  debug("[OPTION] Running doctoc...");
  var includeTOC = false;

  //TODO make this JSON available in DEBUG=defaults
  var defaultDocToc = {
    "mode": "github",
    "maxlevel": 3,
    "title": "",
    "notitle": true,
    "entryprefix": "",
    "all": false,
    "stdout": true,
    "update-only": false
  };
  var finalDoctoc = defaultDocToc;
  var obj = { doctocGlobal, doctocLocal };
  for (var options in obj) {
    if (options == "doctocGlobal") debugDoctoc("Apply Global Options: " + JSON.stringify(obj[options]));
    else debugDoctoc("Apply Local Options: " + JSON.stringify(obj[options]));
    if (obj[options] != undefined) {
      if (typeof obj[options] === "boolean") {
        includeTOC = obj[options];
      } else if (typeof obj[options] === "string") {
        finalDoctoc.title = obj[options];
        finalDoctoc.notitle = false;
        includeTOC = true;
      } else {
        for (var key in finalDoctoc) {
          if (Object.prototype.hasOwnProperty.call(obj[options], key)) {
            finalDoctoc[key] = obj[options][key];
            if (key == "title") finalDoctoc.notitle = false;
            includeTOC = true;
          }
        }
      }
    }
  }

  if (includeTOC) {
    debugDoctoc(JSON.stringify(finalDoctoc, null, 2));
    var out = doctoc(fileContents, "github.com",
      finalDoctoc.maxlevel,
      finalDoctoc.title,
      finalDoctoc.notitle,
      finalDoctoc.entryprefix,
      finalDoctoc.all,
      finalDoctoc.stdout,
      finalDoctoc["update-only"]);
    if (!out.transformed) {
      debugDoctoc("No generated TOC based on document and maxlevel");
      return fileContents;
    }
    if (out.data == null) return;

    debugDoctoc("doctoc TOC generated");
    return out.data;
  }
  return fileContents;
}

/** Function that uses markdown-link-check to validate all URLS and relative links to images
 * Writes a file called outputFile.linkcheck.md with the results
 * https://github.com/tcort/markdown-link-check
 * DEBUG=merge:linkcheck
 */
function linkcheck(inputFileStr, fileToWrite) {
  debugLinkcheck("LC start");
  var inputFolder = path.dirname(inputFileStr);
  var base = new URL(path.join("file:", path.resolve(inputFolder))); //TODO Might be failing on windows

  var fileContents = fs.readFileSync(inputFileStr, "utf-8");
  debugLinkcheck("Async linkcheck for " + inputFileStr + " added.");
  markdownLinkCheck(fileContents,
    {
      baseUrl: base,
      ignorePatterns: [{ pattern: "^http://localhost" }],
      timeout: "2s"
    }, function (err, results) {
      if (err) {
        console.error("markdownlinkcheck failed on: " + inputFileStr);
        return;
      }
      var linkcheckResults = "FILE: " + inputFileStr;
      debugLinkcheck(linkcheckResults);
      linkcheckResults += " \n";
      results.forEach(function (result) {
        var icon = "";
        switch (result.status) {
        case "alive":
          icon = "✓";
          break;
        case "dead":
          icon = "x";
          break;
        case "ignored":
          icon = "-";
          break;
        }
        var statusStr = "[" + icon + "] " + result.link + " is " + result.status;
        debugLinkcheckDeep(statusStr);
        if (result.status != "alive") {
          linkcheckResults += " " + statusStr + " \n";
        }
      });
      debugLinkcheck("deep complete");
      linkcheckResults += "\n " + results.length + " links checked. \n\n  \n";
      if (fs.existsSync(fileToWrite)) {
        return safelyWriteFile(fileToWrite, linkcheckResults, true);
      } else {
        return safelyWriteFile(fileToWrite, linkcheckResults);
      }
    });
}

function replaceExtension(filePath, newExt) {
  const dir = path.dirname(filePath);
  const name = path.basename(filePath, path.extname(filePath));
  const ext = newExt.startsWith('.') ? newExt : '.' + newExt;
  return path.join(dir, name + ext);
}

function deleteGeneratedFiles(fileArr) {
  fileArr.forEach(element => {
    if (fs.existsSync(element)) {
      fs.unlinkSync(element);
    }
  });
}

function safelyWriteFile(filePath, contents, append) {
  try {
    //Create the output directory structure if it doesn't exist
    mkdirp.sync(path.dirname(filePath));
    if (append) {
      fs.appendFileSync(filePath, contents, "utf-8");
    } else {
      fs.writeFileSync(filePath, contents, "utf-8");
    }
    return filePath;
  } catch (err) {
    console.error("Error writing file: " + filePath);
  }
}

exports.start = start;