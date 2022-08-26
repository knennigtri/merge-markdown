"use strict";
var path = require('path');
var fs  =  require('fs');
var concat = require('concat');
var markdownLinkCheck = require('markdown-link-check');
var doctoc = require('doctoc/lib/transform');
var validUrl = require('valid-url');
var v,d,onlyQA;
var EXT = {
    "linkcheck": ".linkcheck.md",
    "qa": ".qa.md",
    "out": ".out.md",
    "ref": ".ref.md"
};
exports.EXT = EXT;


var markdownMerge = function(manifestJSON, relPathManifest, verbose ,debug, qaContent){
    v = verbose || false;
    d = debug || false;
    onlyQA = qaContent || false;
    var inputJSON = manifestJSON.input;
    var outputFileStr = relPathManifest +"/"+ manifestJSON.output;
    var outputLinkcheckFileStr = outputFileStr.replace(".md",EXT.linkcheck);
    var qaRegex;
    if(onlyQA) qaRegex = new RegExp(manifestJSON.qa.exclude);
    if(onlyQA && v) console.log("QA exclude regex: " + qaRegex);

    //Iterate through all of the input files in manifest apply options
    var fileArr= [];
    var refFileArr= [];
    Object.keys(inputJSON).forEach(function(inputKey) {
        var inputFileStr = relPathManifest +"/"+ inputKey;
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
        if (v) console.log("--applying manifest options--");
        generatedContent = applyGeneratedContent(generatedContent,manifestJSON);
        //Applies file specific generate rules
        if (v) console.log("--applying file options--");
        generatedContent = applyGeneratedContent(generatedContent,inputJSON[inputKey]);
        var tempFile = inputFileStr+".temp";
        fs.writeFileSync(tempFile,generatedContent);
        
        //checks for broken links within the content
        linkCheck(inputFileStr,outputLinkcheckFileStr);

        //add the  temp file to the list to merge together
        fileArr.push(tempFile);
        console.log(path.basename(tempFile)+" added to merge list");

        //Adds any same name .ref.md files to refFilesList
        var refFileStr = inputFileStr.replace(".md",EXT.ref)
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
        outputFileStr = outputFileStr.replace(".md",EXT.qa);
    }
    if(manifestJSON.mergedTOC){
        return createSingleFile(mergedFileArr, outputFileStr, manifestJSON.mergedTOC);
    }
    return createSingleFile(mergedFileArr, outputFileStr);
}

async function createSingleFile(list, outputFileStr, doctocOptions){
    if (d) console.log("Creating single file");
    if(list == null || list == ""){
        console.log("List to merge is not valid. Aborting..");
        return;
    }
    var outputPath = path.dirname(outputFileStr);
    if(!fs.existsSync(outputPath)){
        fs.mkdirSync(outputPath);
    }
    concat(list, outputFileStr);

    //Remove temp files
    findFiles('./',/\.temp$/,function(tempFilename){
        fs.unlinkSync(tempFilename);
    });

    
    if(doctocOptions){
        var promise = new Promise((res, rej) => {
            setTimeout(() => res("Now it's done!"), 500)
        });
        var wait = await promise; 

        var mergedContent = fs.readFileSync(outputFileStr, 'utf-8');
        fs.rmSync(outputFileStr);
        // Write TOC with doctoc
        //(files, mode, maxHeaderLevel, title, notitle, entryPrefix, processAll, stdOut, updateOnly)
        var outDoctoc = doctoc(mergedContent,"github.com",3,"",false,"",false,true, false);
        fs.writeFileSync(outputFileStr, outDoctoc.data, 'utf-8');
    }
    return outputFileStr;
}

function applyGeneratedContent(origContent, fileOptions) {
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
        // https://github.com/thlorenz/doctoc
        //(files, mode, maxHeaderLevel, title, notitle, entryPrefix, processAll, stdOut, updateOnly)
        var outDoctoc = doctoc(scrubbedContent,"github.com",3,tocTitle,false,"",true,true,false);
        if(outDoctoc.data != null){
            scrubbedContent = outDoctoc.data;
            if (v) console.log("TOC Added");
        }
    } 
    return scrubbedContent;
} 

/** Searches for ![*](relPath) or src="relPath" in a string and replaces the asset
 * relPath with an absolute one
 */
function updateAssetRelPaths(fileContents,inputPath){
    var resultContent=[];
    var regex = /(!\[(.*?)\][(](.*?)[)])|(src=["'](.*?)["'])/g;

    if(d) console.log("Rewriting Relative Asset Paths");

    //Go through each line that and 
    var lines = fileContents.split("\n");
    lines.forEach(line => {
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

                if(d) console.log("origAssetRelPath: "+origAssetRelPath);
                if(d) console.log("origAssetPath: "+origAssetPath);

                var newLine = line.replace(origAssetRelPath,origAssetPath);
                resultContent.push(newLine);
            }else{
                resultContent.push(line);
            }
        }else{
            resultContent.push(line);
        }
    });
    return resultContent.join("\n");
}

/** Removes the YAML at the top of a markdown file
 * @param {*} fileContents String that might contain YAML
 * @returns String that has YAML removed
 */
function removeYAML(fileContents) {
    if(d) console.log("Removing YAML content");
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
    if(d) console.log("S("+startYAML+")E("+endYAML+")✓'d("+i+")T("+lines.length+")");
    if(startYAML != -1 && endYAML != -1){
        //shows YAML being removed
        if(d) console.log("Removing S("+startYAML+")->E("+endYAML+") YAML:")
        var yaml = lines.splice(startYAML,1+endYAML-startYAML).join("\n");
        if(d) console.log(yaml);
        resultContent = lines.join("\n");
        if (v) console.log("YAML removed");
    } else {
        if (v) console.log("No YAML found for removal");
    }
    return  resultContent;
}

/** Replaces any value with another value. 
 * Regex values are allowed and will be wrapped with /str/g
 * @param {*} fileContents - String that contains the replaceable characters
 * @param {*} replacements - key value pairs that contain the find/replace values.
 * @returns String that contains the replaced keys with their values
 */
function replaceStrings(fileContents,replacements){
    if(d) console.log("Find and Replacing Strings");
    var replacedContent = fileContents;
    Object.keys(replacements).forEach(function(replaceKey) {
        var findRegex = "";
        findRegex = new RegExp(replaceKey, 'g');
        var replaceStr = replacements[replaceKey];
        if(v) console.log("Replacing: "+findRegex+" with: "+replaceStr);
        replacedContent = replacedContent.replace(findRegex,replaceStr); 
    });
    return replacedContent;
}

/** Function that uses markdown-link-check to validate all URLS and relative links to images
 * Writes a file called outputFile.linkcheck.md with the results
 * https://github.com/tcort/markdown-link-check
 * @param {*} inputFileStr markdown file name to perform link checking
 * @param {*} outputFileStr output file name to write the results to
 */
function linkCheck(inputFileStr, outputFileStr) {
    if(d) console.log("Linkchecking...");
    var outputFolder = path.dirname(outputFileStr)
    if(!fs.existsSync(outputFolder)){
        fs.mkdirSync(outputFolder);
    } else {
        if(fs.existsSync(outputFileStr)){
            fs.unlinkSync(outputFileStr);
        }
    }
    
    var inputFolder = path.dirname(inputFileStr);
    var base = path.join("file://",process.cwd(),inputFolder);
    if(d) console.log("Input Folder Location: "+base);
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
            var linkcheckResults = "FILE: " + inputFileStr + " \n";
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
                if(d) linkcheckResults+=" "+ statusStr + " \n";
                if(!d && result.status != "alive"){
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

// Helper method to find all .temp files and do something with them
function findFiles(startPath,filter,callback){
    if (!fs.existsSync(startPath)){
        console.log("no dir ",startPath);
        return;
    }
    var files=fs.readdirSync(startPath);
    for(var i=0;i<files.length;i++){
        var filename=path.join(startPath,files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory()){
            findFiles(filename,filter,callback); //recurse
        }
        else if (filter.test(filename)) callback(filename);
    };
}

exports.markdownMerge = markdownMerge;