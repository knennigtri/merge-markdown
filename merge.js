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
var debugDoctoc = require('debug')('merge:doctoc');
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

var markdownMerge = function(manifestJSON, relPathManifest, qaContent, noLinkCheck){
    onlyQA = qaContent || false;
    var inputJSON = manifestJSON.input;
    var outputFileStr = path.join(relPathManifest, manifestJSON.output)
    var doNotCreateLinkcheckFile = noLinkCheck;
    var outputLinkcheckFileStr = updateExtension(outputFileStr, EXT.linkcheck);
    var qaRegex;
    if(manifestJSON.qa) qaRegex = new RegExp(manifestJSON.qa.exclude);
    if(onlyQA) console.log("QA exclude regex: " + qaRegex);

    if(doNotCreateLinkcheckFile) console.log("Skipping linkcheck on all files");

    //Iterate through all of the input files in manifest apply options
    var fileArr= [];
    var refFileArr= [];
    Object.keys(inputJSON).forEach(function(inputKey) {
        var inputFileStr = path.join(relPathManifest, inputKey);
        console.log("--"+inputFileStr+"--");

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

        debug("--Apply file OPTIONS--");
        //Content, local options, global options
        generatedContent = applyContentOptions(generatedContent,inputJSON[inputKey],manifestJSON);

        var tempFile = inputFileStr+".temp";
        fs.writeFileSync(tempFile,generatedContent);
        
        if(!doNotCreateLinkcheckFile){
            //checks for broken links within the content
            debug("--Create/Update linkcheck file--");
            linkCheck(tempFile,outputLinkcheckFileStr);
        }

        //add the  temp file to the list to merge together
        fileArr.push(tempFile);
        debug(path.basename(tempFile));
        console.log("...added to merge list");

        //Adds any same name .ref.md files to refFilesList
        var refFileStr = updateExtension(inputFileStr, EXT.ref)
        if(fs.existsSync(refFileStr)){
            console.log(path.basename(refFileStr)+ " added to references merge list");
            refFileArr.push(refFileStr);
        } 
    });

    console.log("+++++++++++++")
    //Merge lists and output single markdown file
    var mergedFileArr = fileArr.concat(refFileArr);
    
    console.log("Creating Merged Markdown:\n " + mergedFileArr.join("\n "));
    if(onlyQA){
        outputFileStr = updateExtension(outputFileStr,EXT.qa);
    }
    var mergedTOC = manifestJSON.output.mergedTOC || manifestJSON.mergedTOC;
    if(mergedTOC){
        createSingleFile(mergedFileArr, outputFileStr, mergedTOC);
    } else {
        createSingleFile(mergedFileArr, outputFileStr);
    }
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
                    if (err) {
                        console.log("DOCTOC Error: " +err);
                        return;
                    }
                    removeTempFiles(list); //cleanup
                    console.log(outputFileStr + " created.");
                    return outputFileStr;
                });
            });
        } else {
            removeTempFiles(list); //cleanup
            console.log(outputFileStr + " created.");
            return outputFileStr;
        }
    });
}

//Content, local options, global options
function applyContentOptions(origContent, fileOptions, globalOptions) {
    var scrubbedContent = origContent;

    if(fileOptions == null) return scrubbedContent;
    /* Apply noYAML */
    //Apply local noYAML option
    if(fileOptions.hasOwnProperty("noYAML")){ 
        if(fileOptions.noYAML){
            debug("Using [Local] noYAML...");
            scrubbedContent = removeYAML(origContent);
        }
    } else //Apply global noYAML option
        if(globalOptions.hasOwnProperty("noYAML") && globalOptions.noYAML){ 
            debug("Using [Global] noYAML...");
        scrubbedContent = removeYAML(origContent);
    }

    /* Apply find and replace */
    //Apply local replace
    if(fileOptions.hasOwnProperty("replace")){
        // merge global replace with local replace taking precedence
        if(globalOptions.hasOwnProperty("replace")){
            for (var key in globalOptions.replace){
                if(!fileOptions.replace.hasOwnProperty(key)){
                    fileOptions.replace[key] = globalOptions.replace[key];
                }
            }
            debug("Using [Local/Global] Find/Replace...");
            scrubbedContent = replaceStrings(scrubbedContent,fileOptions.replace);
        } else {
            debug("Using [Local] Find/Replace...");
            scrubbedContent = replaceStrings(scrubbedContent,fileOptions.replace);
        }
    } else //Apply global replace
    if(globalOptions.hasOwnProperty("replace")){
        debug("Using [Global] Find/Replace...");
        scrubbedContent = replaceStrings(scrubbedContent,globalOptions.replace);
    }

    //Add TOC
    if(fileOptions.hasOwnProperty("TOC")){
        if(fileOptions.TOC){
            debugDoctoc("Using [Local] DocToc...");
            scrubbedContent = buildTOC(scrubbedContent,fileOptions.TOC);
        }
    } else if(globalOptions.hasOwnProperty("TOC") && globalOptions.TOC){
        debug("Using [Global] DocToc...");
        scrubbedContent = buildTOC(scrubbedContent,globalOptions.TOC);
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
        var relAssetPath = "";
        //if found capture relPath
        if(match != null){
            var origStr = match[0];
            //Example: ![my-asset](links/my-asset.jpg)
            if(origStr.startsWith("![")){
                relAssetPath = origStr.substring(origStr.indexOf("(")+1,origStr.indexOf(")"));
            } else {
                //Example: src="links/my-asset.jpg"
                if(origStr.startsWith("src=")){
                    relAssetPath = origStr.substring(origStr.indexOf("\"")+1,origStr.lastIndexOf("\""));
                }
            } 
            //Check if path is a URL
            if(!validUrl.isUri(relAssetPath)){
                //resolve the asset path
                var absAssetPath = path.resolve(inputPath, relAssetPath);

                count++;
                debugRelLinks("[Line " + lineNumber + "]: "+relAssetPath);
                debugRelLinks("Updated to: "+absAssetPath);

                var newLine = line.replace(relAssetPath,absAssetPath);
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

/*

*/
function buildTOC(fileContents,doctocOptions){
    debug("[OPTION] Add TOC...");
    var defaultDocToc = {
        "mode": "github.com",
        "maxlevel": 3,
        "title": "## Contents",
        "notitle": false,
        "all": true,
        "stdout": true,
        "update-only": false
    };
    // if (doctocOptions === 'boolean'){

    // }
    var tocTitle = "#### Module Contents";
    if(doctocOptions.toString().toLowerCase() != "true"){
        if(typeof doctocOptions === 'string') {
            tocTitle = doctocOptions;   
        }
    } 
    debugDoctoc("tocTitle: " + tocTitle);
    //(file, mode, maxlevel, title, notitle, entryprefix, all, stdOut, update-only)
    //all = process all TOCs in a file
    //update-only = only updates if there is an existing TOC
    var out = doctoc(fileContents,"github.com",3,tocTitle,false,"",true,true,false);
    
    if(out.data == null) return;
    
    debugDoctoc("TOC Added");
    return out.data;
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
    var base = new URL(path.join("file:",path.resolve(inputFolder))); //TODO Might be failing on windows
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