"use strict";
var path = require('path');
var fs  =  require('fs');
var concat = require('concat');
var markdownLinkCheck = require('markdown-link-check');
var doctoc = require('doctoc/lib/transform');
var validUrl = require('valid-url');
var debug = require('debug')('merge');
var debugRelLinks  = require('debug')('merge:relLinks');
var debugYaml = require('debug')('merge:yaml');
var debugtoc = require('debug')('merge:toc');
var debugReplace = require('debug')('merge:replace');
var debugLinkcheck = require('debug')('merge:linkcheck');
var onlyQA;
var EXT = {
    "linkcheck": ".linkcheck.md",
    "qa": ".qa.md",
    "out": ".out.md",
    "ref": ".ref.md"
};
exports.EXT = EXT;

var markdownMerge = function(manifestJSON, relPathManifest, qaContent){
    onlyQA = qaContent || false;
    var inputJSON = manifestJSON.input;
    var outputFileStr = path.join(relPathManifest, manifestJSON.output)
    var outputLinkcheckFileStr = updateExtension(outputFileStr, EXT.linkcheck);
    var qaRegex;
    if(manifestJSON.qa) qaRegex = new RegExp(manifestJSON.qa.exclude);
    if(onlyQA) console.log("QA exclude regex: " + qaRegex);

    //Iterate through all of the input files in manifest apply options
    var fileArr= [];
    var refFileArr= [];
    Object.keys(inputJSON).forEach(function(inputKey) {
        var inputFileStr = path.join(relPathManifest, inputKey);
        console.log("*********"+inputFileStr+"*********");

        if(onlyQA && qaRegex.test(inputFileStr)){
            console.warn("Skipping " +inputKey + " for QA");
            return;
        } 
        if (!fs.existsSync(inputFileStr)){
            console.warn(inputKey + " does not exist. Skipping.");
            return;
        }  
        var origContent = fs.readFileSync(inputFileStr, 'utf-8');
        
        //updates all relative asset paths to the relative output location
        var generatedContent = updateAssetRelPaths(origContent,path.dirname(inputFileStr), path.dirname(outputFileStr));
        
        //applies gobal generate rules
        debug("--Apply global manifest OPTIONS--");
        generatedContent = applyContentOptions(generatedContent,manifestJSON);
        //Applies file specific generate rules
        debug("--Apply file specific OPTIONS--");
        generatedContent = applyContentOptions(generatedContent,inputJSON[inputKey]);
        var tempFile = inputFileStr+".temp";
        fs.writeFileSync(tempFile,generatedContent);
        
        //checks for broken links within the content
        debug("--Create/Update linkcheck file--");
        linkCheck(inputFileStr,outputLinkcheckFileStr);

        //add the  temp file to the list to merge together
        fileArr.push(tempFile);
        console.log(path.basename(tempFile)+" added to merge list");

        //Adds any same name .ref.md files to refFilesList
        var refFileStr = updateExtension(inputFileStr, EXT.ref)
        if(fs.existsSync(refFileStr)){
            console.log(path.basename(refFileStr)+ " added to references merge list");
            refFileArr.push(refFileStr);
        } 
    });

    console.log("++++++++++++++++++++")
    //Merge lists and output single markdown file
    var mergedFileArr = fileArr.concat(refFileArr);
    
    console.log("List of files to merge:\n    " + mergedFileArr.join("\n    "));
    if(onlyQA){
        outputFileStr = updateExtension(outputFileStr,EXT.qa);
    }
    if(manifestJSON.mergedTOC){
        outputFileStr = createSingleFile(mergedFileArr, outputFileStr, manifestJSON.mergedTOC);
    } else {
        outputFileStr = createSingleFile(mergedFileArr, outputFileStr);
    }
    
    //cleanup 
    removeTempFiles(mergedFileArr);

    return outputFileStr;
}

function createSingleFile(list, outputFileStr, doctocOptions){
    debug("Creating single file");
    if(list == null || list == ""){
        console.log("List to merge is not valid. Aborting..");
        return;
    }
    var outputPath = path.dirname(outputFileStr);
    if(!fs.existsSync(outputPath)){
        fs.mkdirSync(outputPath);
    }
    concat(list, outputFileStr).then(result => {
        if(doctocOptions){
            fs.readFile(outputFileStr, 'utf-8', function (err, data) {
                var outDoctoc = doctoc(data,"github.com",3,"",false,"",false,true, false);
                fs.writeFile(outputFileStr, outDoctoc.data, 'utf-8', function (err) {
                    if (err) return console.log(err);
                    return outputFileStr;
                });
            });
        } else {
            return outputFileStr;
        }
    });
}

function applyContentOptions(origContent, fileOptions) {
    var scrubbedContent = origContent;

    if(fileOptions == null) return scrubbedContent;
    //Remove YAML
    if(fileOptions.hasOwnProperty("noYAML") && fileOptions.noYAML){
        var contentNoYAML = removeYAML(origContent);
        scrubbedContent = contentNoYAML;
    }
    //Allows for find and replace options in the markdown with ${}
    if(fileOptions.hasOwnProperty("replace") && fileOptions.replace){
        scrubbedContent = replaceStrings(scrubbedContent,fileOptions.replace);
    }
    //Add TOC
    if(fileOptions.hasOwnProperty("TOC") && fileOptions.TOC){
        var tocTitle = "#### Module Contents";
        var outDoctoc = "";
        if(fileOptions.TOC.toString().toLowerCase() != "true"){
            tocTitle = fileOptions.TOC
        } 
        debug("[OPTION] Add TOC...");
        //(files, mode, maxHeaderLevel, title, notitle, entryPrefix, processAll, stdOut, updateOnly)
        var outDoctoc = doctoc(scrubbedContent,"github.com",3,tocTitle,false,"",true,true,false);
        if(outDoctoc.data != null){
            scrubbedContent = outDoctoc.data;
            debugtoc("TOC Added");
        }
    } 
    return scrubbedContent;
} 

/** Searches for ![*](relPath) or src="relPath" in a string and replaces the asset
 * relPath with an absolute one
 * Debug=merge:relLinks
 */
function updateAssetRelPaths(fileContents,inputPath){
    var resultContent=[];
    var regex = /(!\[(.*?)\][(](.*?)[)])|(src=["'](.*?)["'])/g;

    debug("Rewriting Relative Asset Paths");

    //Go through each line that and 
    var lines = fileContents.split("\n");
    var count = 0;
    lines.forEach((line, lineNumber) => {
        var match = line.match(regex);
        var origAssetRelPath = "";
        //if found capture relPath
        if(match != null){
            var origStr = match[0];
            if(origStr.startsWith("![")){
                origAssetRelPath = origStr.substring(origStr.indexOf("(")+1,origStr.indexOf(")"));
            } else if(origStr.startsWith("src=")){
                origAssetRelPath = origStr.substring(origStr.indexOf("\"")+1,origStr.lastIndexOf("\""));
            } 
            if(!validUrl.isUri(origAssetRelPath)){
                //resolve the asset path
                var origAssetPath = path.resolve(inputPath, origAssetRelPath);

                count++;
                debugRelLinks("[Line " + lineNumber + "]: "+origAssetRelPath);
                debugRelLinks("Updated to: "+origAssetPath);

                var newLine = line.replace(origAssetRelPath,origAssetPath);
                resultContent.push(newLine);
            }else{
                resultContent.push(line);
            }
        }else{
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
function removeYAML(fileContents) {
    debug("[OPTION] Remove YAML...");
    var resultContent = fileContents;
    var lines = fileContents.split("\n");
    var i=0;
    var startYAML=-1;
    var endYAML=-1;
    for (i=0; i < lines.length; i++) {
        var line = lines[i];
        //Stop searching if there is no YAML
        if(i == 0 && line != "---"){
            break;
        }
        //Set start/end YAML indexes if they are available
        if(i == 0 && startYAML == -1 && line == "---"){
                startYAML=i;
        } else if(startYAML != -1 && endYAML == -1 && line == "---"){
                endYAML = i;
                break;
        }//TODO YAML is on line 2 or (\n\r before YAML..)
        
        //Stop searching if a header # is reached
        if(startYAML != -1 && line.startsWith("#")){
            break;
        }
    }
    debugYaml("S("+startYAML+")E("+endYAML+")✓'d("+i+")T("+lines.length+")");
    if(startYAML != -1 && endYAML != -1){
        //shows YAML being removed
        debugYaml("Removing S("+startYAML+")->E("+endYAML+") YAML:")
        var yaml = lines.splice(startYAML,1+endYAML-startYAML).join("\n");
        debugYaml(yaml);
        resultContent = lines.join("\n");
        debugYaml("YAML removed");
    } else {
        debugYaml("No YAML found for removal");
    }
    return  resultContent;
}

/** Replaces any value with another value. 
 * Regex values are allowed and will be wrapped with /str/g
 * Debug=merge:replace
 */
function replaceStrings(fileContents,replacements){
    debug("[OPTION] Find and Replace Strings...");
    var replacedContent = fileContents;
    Object.keys(replacements).forEach(function(replaceKey) {
        var findRegex = "";
        findRegex = new RegExp(replaceKey, 'g');
        var replaceStr = replacements[replaceKey];
        debugReplace("Replacing: "+findRegex+" with: "+replaceStr);
        replacedContent = replacedContent.replace(findRegex,replaceStr); 
    });
    return replacedContent;
}

/** Function that uses markdown-link-check to validate all URLS and relative links to images
 * Writes a file called outputFile.linkcheck.md with the results
 * https://github.com/tcort/markdown-link-check
 * DEBUG=merge:linkcheck
 */
function linkCheck(inputFileStr, outputFileStr) {
    var outputFolder = path.dirname(outputFileStr)
    if(!fs.existsSync(outputFolder)){
        fs.mkdirSync(outputFolder);
    } else {
        if(fs.existsSync(outputFileStr)){
            fs.unlinkSync(outputFileStr);
        }
    }
    
    var inputFolder = path.dirname(inputFileStr);
    var base = path.join("file:",path.resolve(inputFolder)); //TODO Might be failing on windows
    debugLinkcheck("Folder to be linkchecked: "+base);
    var fileContents = fs.readFileSync(inputFileStr, 'utf-8');
    markdownLinkCheck(fileContents,
        {
            baseUrl: base,
            ignorePatterns: [{ pattern: "^http://localhost" }],
        }, function (err, results) {
            if (err) {
                console.error('Error', err);
                return;
            }
            var linkcheckResults = "FILE: " + inputFileStr;
            debugLinkcheck(linkcheckResults);
            linkcheckResults += " \n";
            results.forEach(function (result) {
                var icon = "";
                switch(result.status) {
                    case "alive":
                      icon = "✓"
                      break;
                    case "dead":
                      icon = "x";
                      break;
                    case "ignored":
                        icon="-"
                        break;
                  }
                var statusStr="["+icon+"] " + result.link + " is " + result.status;
                debugLinkcheck(statusStr);
                if(result.status != "alive"){ 
                    linkcheckResults+=" "+ statusStr + " \n";
                }
            });
            linkcheckResults+="\n "+results.length +" links checked. \n\n  \n";
            if(fs.existsSync(outputFileStr)){
                fs.appendFileSync(outputFileStr,linkcheckResults);
            }else{
                fs.writeFileSync(outputFileStr,linkcheckResults);
            }
    });
}

//Helper method to updateing the extension
function updateExtension(fileStr, newExt){
    var ext = path.extname(fileStr);
    if(ext != ""){
        var i = fileStr.lastIndexOf(".");
        fileStr = fileStr.substring(0,i);
    }
    if(newExt.charAt(0) != ".") newExt = "." + newExt;
    return fileStr +newExt;
}

function removeTempFiles(fileArr){
    fileArr.forEach(element => {
        fs.unlinkSync(element);
    });
}

exports.markdownMerge = markdownMerge;