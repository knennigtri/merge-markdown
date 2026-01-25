const manifestUtil = require("./manifest.js");
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");
const concat = require("concat");
const markdownLinkCheck = require("markdown-link-check");
const doctoc = require("doctoc/lib/transform");
const validUrl = require("valid-url");
const { pathToFileURL } = require("url");
const assetCleaner = require("./asset-cleaner.js");
const debug = require("debug")("merge");
const debugRelLinks = require("debug")("rellinks");
const debugYaml = require("debug")("o:yaml");
const debugDoctoc = require("debug")("o:doctoc");
const debugReplace = require("debug")("o:replace");
const debugLinkcheck = require("debug")("linkcheck");
const debugLinkcheckDeep = require("debug")("linkcheck:deep");
const debugAssetPreview = require("debug")("asset-preview");
const EXTS = {
  "linkcheck": ".linkcheck.md",
  "qa": ".qa.md"
};
exports.EXTS = EXTS;

exports.debbugOptions = {
  "merge": "messages for merge process",
  "rellinks": "relative links",
  "o:yaml": "yaml removal",
  "o:doctoc": "doctoc messages",
  "o:replace": "regex replace messages",
  "linkcheck": "linkcheck validation",
  "linkcheck:deep": "deep linkcheck validation",
  "asset-preview": "asset preview scanning during merge"
};

function start(manifestFileStr, qaMode, skip_linkcheck, maintainAssetPaths, lang, disableAssetPreview) {
  var onlyQA = qaMode || false;
  var skipLinkcheck = skip_linkcheck || false;
  var keepAssetPaths = maintainAssetPaths || false;
  var skipAssetPreview = disableAssetPreview || false;

  //Set manifest variables
  const manifest = manifestUtil.getJSON_withABSPaths(manifestFileStr, onlyQA, lang);
  var manifestOutputName = manifest.output.name;
  var manifestInput = manifest.input;
  var manifestQARegEx;
  if (manifest.qa) manifestQARegEx = new RegExp(manifest.qa.exclude);
  
  if (onlyQA) console.log("QA exclude regex: " + manifestQARegEx);

  if (skipLinkcheck) console.log("Skipping linkcheck on all files");
  else debugLinkcheck("Phase 1: Checking assets and external URLs per file...");

  //removes old .md files
  deleteGeneratedFiles([
    manifestOutputName,
    replaceExtension(manifestOutputName, EXTS.linkcheck),
    replaceExtension(manifestOutputName, EXTS.qa)
  ]);

  //Iterate through all of the input files in manifest apply options
  var fileArr = [];
  var refFileArr = [];
  var linkcheckPromises = [];
  
  console.log("\n📝 Processing input files...");
  
  Object.keys(manifestInput).forEach(function (inputKey) {
    var inputFileName = path.basename(inputKey);
    if (onlyQA && manifestQARegEx.test(inputFileName)) {
      console.log("   ⊘ " + inputFileName + " (excluded for QA)");
      return;
    }
    if (!fs.existsSync(inputKey)) {
      const isAbsolutePath = path.isAbsolute(inputKey);
      if (isAbsolutePath) {
        console.log(inputKey + " (file not found)");
        console.log("WARN: Absolute file paths in the manifest are not supported in Docker mode. Consider using relative paths instead.");
      } else {
        console.log("⚠ " + inputKey + " (file not found)");
      }
      return;
    }
    console.log("   ✓ " + inputFileName);
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
      //Phase 1: checks for broken assets and external URLs
      debug("--Phase 1 linkcheck: assets and URLs--");
      linkcheckPromises.push(checkAssetsAndUrls(tempFile, inputFileName));
    }

    //add the  temp file to the list to merge together
    fileArr.push(tempFile);
    debug(path.basename(tempFile));
  });
  
  // Wait for all Phase 1 linkchecks to complete, then write results in order
  if (!skipLinkcheck && linkcheckPromises.length > 0) {
    return Promise.all(linkcheckPromises).then((results) => {
      // Write Phase 1 results in order
      const linkcheckFile = replaceExtension(manifestOutputName, EXTS.linkcheck);
      results.forEach((result) => {
        if (fs.existsSync(linkcheckFile)) {
          safelyWriteFile(linkcheckFile, result, true);
        } else {
          safelyWriteFile(linkcheckFile, result, false);
        }
      });
      
      // Continue with merge
      return continueMerge(fileArr, refFileArr, manifestOutputName, onlyQA, manifest, skipAssetPreview, skipLinkcheck);
    });
  } else {
    return continueMerge(fileArr, refFileArr, manifestOutputName, onlyQA, manifest, skipAssetPreview, skipLinkcheck);
  }
}

function continueMerge(fileArr, refFileArr, manifestOutputName, onlyQA, manifest, skipAssetPreview, skipLinkcheck) {
  //Merge lists and output single markdown file
  var mergedFileArr = fileArr.concat(refFileArr);

  if (mergedFileArr.length > 0) {
    console.log("\n🔗 Merging " + mergedFileArr.length + " file(s)...");
  }
  
  var fileToWrite = manifestOutputName;
  if (onlyQA) {
    fileToWrite = replaceExtension(fileToWrite, EXTS.qa);
  }
  return createSingleFile(mergedFileArr, fileToWrite, manifest, skipAssetPreview, skipLinkcheck);
}

async function createSingleFile(list, fileToWrite, manifestJSON, skipAssetPreview, skipLinkcheck) {
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
    
    // Phase 2: Check internal anchors in merged file
    if (!skipLinkcheck) {
      debugLinkcheck("Phase 2: Checking internal anchors in merged file...");
      console.log("🔍 Validating internal anchors...");
      checkAnchors(fileToWrite, replaceExtension(fileToWrite, EXTS.linkcheck));
    }
    
    // Run asset preview scan if not disabled
    if (!skipAssetPreview && manifestJSON.input) {
      runAssetPreviewScan(Object.keys(manifestJSON.input));
    }
    
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

/**
 * Phase 1: Check assets (markdown and HTML img tags) and external URLs in individual files
 * Ignores internal anchors to avoid false positives from cross-file references
 * Returns a promise that resolves with the linkcheck results string
 */
function checkAssetsAndUrls(inputFileStr, inputFileName) {
  debugLinkcheck("Phase 1: Asset and URL check for " + inputFileName);
  var inputFolder = path.dirname(inputFileStr);
  var fileContents = fs.readFileSync(inputFileStr, "utf-8");
  
  return new Promise((resolve) => {
    var linkcheckResults = "FILE: " + inputFileStr + "\n";
    
    // Custom asset checking for both markdown and HTML images
    const assetIssues = checkAssetPaths(fileContents, inputFolder);
    assetIssues.forEach(issue => {
      linkcheckResults += ` [x] ${issue.type}: ${issue.path} is dead\n`;
    });
    
    // Use markdown-link-check for external URLs only (ignore anchors)
    markdownLinkCheck(fileContents,
      {
        baseUrl: pathToFileURL(path.resolve(inputFolder)),
        ignorePatterns: [
          { pattern: "^http://localhost" },
          { pattern: "^#" }  // Ignore internal anchors in Phase 1
        ],
        timeout: "2s"
      }, function (err, results) {
        if (err) {
          console.error("markdown-link-check failed on: " + inputFileStr);
          linkcheckResults += " Error during linkcheck\n\n  \n";
          resolve(linkcheckResults);
          return;
        }
        
        // Only report external URL issues
        results.forEach(function (result) {
          if (result.status === "dead" && !result.link.startsWith("#")) {
            linkcheckResults += ` [x] URL: ${result.link} is dead\n`;
          }
        });
        
        const urlCount = results.filter(r => !r.link.startsWith("#")).length;
        linkcheckResults += `\n ${assetIssues.length} asset(s) checked, ${urlCount} external URL(s) checked.\n\n  \n`;
        
        resolve(linkcheckResults);
      });
  });
}

/**
 * Phase 2: Check internal anchors in the merged file
 * Validates custom anchor IDs (like {#my-id}) rather than auto-generated header anchors
 */
function checkAnchors(mergedFile, fileToWrite) {
  debugLinkcheck("Phase 2: Anchor check for merged file");
  var fileContents = fs.readFileSync(mergedFile, "utf-8");
  
  // Extract all anchor links from the content
  const anchorRegex = /\[([^\]]+)\]\((#[^)]+)\)/g;
  const anchors = [];
  let match;
  while ((match = anchorRegex.exec(fileContents)) !== null) {
    anchors.push(match[2]); // The #anchor part
  }
  
  // Extract all anchor IDs from the content (explicit {#id} syntax)
  const anchorIdRegex = /\{#([^}]+)\}/g;
  const definedAnchors = new Set();
  while ((match = anchorIdRegex.exec(fileContents)) !== null) {
    definedAnchors.add(`#${match[1]}`);
  }
  
  var linkcheckResults = "\n=== Internal Anchor Validation of merged file ===\n";
  linkcheckResults += "FILE: " + mergedFile + "\n";
  
  if (anchors.length === 0) {
    linkcheckResults += " [✓] No internal anchor references found\n";
  } else {
    var customAnchorsNotFound = 0;
    var customAnchorsFound = 0;
    const checkedAnchors = new Set();
    
    anchors.forEach(anchor => {
      if (!checkedAnchors.has(anchor)) {
        checkedAnchors.add(anchor);
        if (!definedAnchors.has(anchor)) {
          customAnchorsNotFound++;
        } else {
          customAnchorsFound++;
          linkcheckResults += ` [✓] ${anchor} - custom anchor ID found\n`;
        }
      }
    });
    
    if (customAnchorsFound === 0 && customAnchorsNotFound > 0) {
      linkcheckResults += ` [✓] ${anchors.length} anchor reference(s) found (appear to be auto-generated header anchors)\n`;
      linkcheckResults += "\nNote: Only explicit {#anchor} IDs are checked.\n";
      linkcheckResults += "To validate header anchors, review the rendered output.\n";
    } else if (customAnchorsFound > 0) {
      linkcheckResults += `\n ${customAnchorsFound} custom anchor(s) validated successfully.\n`;
      if (customAnchorsNotFound > 0) {
        linkcheckResults += `${customAnchorsNotFound} anchor(s) appear to be header-based (not validated).\n`;
      }
    }
  }
  
  linkcheckResults += "\n  \n";
  
  return safelyWriteFile(fileToWrite, linkcheckResults, true);
}

/**
 * Check asset paths from both markdown images and HTML img tags
 * Returns array of issues with missing assets
 */
function checkAssetPaths(content, baseDir) {
  const issues = [];
  
  // Check markdown images: ![alt](path)
  const mdImageRegex = /!\[.*?\]\(([^)]+)\)/g;
  let match;
  while ((match = mdImageRegex.exec(content)) !== null) {
    const imagePath = match[1].split(/[?#]/)[0]; // Remove query params and anchors
    if (!imagePath.startsWith("http://") && !imagePath.startsWith("https://")) {
      const fullPath = path.isAbsolute(imagePath) ? imagePath : path.resolve(baseDir, imagePath);
      if (!fs.existsSync(fullPath)) {
        issues.push({ type: "![]()", path: imagePath });
      }
    }
  }
  
  // Check HTML images: <img src="path">
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/g;
  while ((match = htmlImageRegex.exec(content)) !== null) {
    const imagePath = match[1].split(/[?#]/)[0]; // Remove query params and anchors
    if (!imagePath.startsWith("http://") && !imagePath.startsWith("https://")) {
      const fullPath = path.isAbsolute(imagePath) ? imagePath : path.resolve(baseDir, imagePath);
      if (!fs.existsSync(fullPath)) {
        issues.push({ type: "<img>", path: imagePath });
      }
    }
  }
  
  return issues;
}

/** Function that uses markdown-link-check to validate all URLS and relative links to images
 * Writes a file called outputFile.linkcheck.md with the results
 * https://github.com/tcort/markdown-link-check
 * DEBUG=merge:linkcheck
 * @deprecated This function is kept for reference but replaced by checkAssetsAndUrls and checkAnchors
 */
// eslint-disable-next-line no-unused-vars
function linkcheck(inputFileStr, fileToWrite) {
  debugLinkcheck("LC start");
  var inputFolder = path.dirname(inputFileStr);
  var base = pathToFileURL(path.resolve(inputFolder));

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
  const ext = newExt.startsWith(".") ? newExt : "." + newExt;
  return path.join(dir, name + ext);
}

/**
 * Runs a quick asset preview scan and displays summary to user
 * @param {Array} inputFiles - Array of input file paths from manifest
 */
function runAssetPreviewScan(inputFiles) {
  debugAssetPreview("Starting asset preview scan");
  
  try {
    // Run quick scan for unused assets
    const scanResult = assetCleaner.scanForUnusedAssets(inputFiles, "assets");
    
    if (scanResult.hasUnusedAssets) {
      console.log(`\n💡 Found ${scanResult.totalUnusedAssets} unused asset${scanResult.totalUnusedAssets === 1 ? "" : "s"} in your project directories.`);
      console.log("   Run 'merge-markdown --clean-assets' to see details and clean up.");
    } else if (scanResult.scannedDirectories > 0) {
      debugAssetPreview(`No unused assets found in ${scanResult.scannedDirectories} directories`);
    } else {
      debugAssetPreview("No asset directories found to scan");
    }
  } catch (error) {
    debugAssetPreview(`Error during asset preview scan: ${error.message}`);
  }
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