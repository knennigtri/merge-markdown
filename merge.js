"use strict";
var path = require('path'),
fs  =  require('fs'),
concat = require('concat'),
markdownLinkCheck = require('markdown-link-check'),
doctoc = require('doctoc/lib/transform'),
validUrl = require('valid-url');
var v,d,onlyQA;
var EXT = {
    "linkcheck": ".linkcheck.md",
    "qa": ".qa.md",
    "out": ".out.md",
    "ref": ".ref.md"
};
exports.EXT = EXT;


exports.add = function(manifestJSON, relPathManifest, verbose,debug,qaContent){
    v = verbose || false;
    d = debug || false;
    onlyQA = qaContent || false;
    var inputJSON = manifestJSON.input;
    var outputFileStr = relPathManifest +"/"+ manifestJSON.output;
    var outputLinkcheckFileStr = outputFileStr.replace(".md",EXT.linkcheck);
    var outputQAFileStr = outputFileStr.replace(".md",EXT.qa);
    var qaRegex;
    if(onlyQA) qaRegex = new RegExp(manifestJSON.qa.exclude);

    //Iterate through all of the input files in manifest apply options
    var fileArr= [];
    var refFileArr= [];
    Object.keys(inputJSON).forEach(function(inputKey) {
        var inputFileStr = relPathManifest +"/"+ inputKey;
        console.log("*********"+inputFileStr+"*********");

        if (!fs.existsSync(inputFileStr)){
            console.warn(inputKey + " does not exist. Skipping.");
            return;
        } 
        if(onlyQA && qaRegex.test(inputFileStr)){
            console.warn("Skipping " +inputKey + " for QA");
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
    createSingleFile(mergedFileArr, outputFileStr);

    //Remove temp files
    findFiles('./',/\.temp$/,function(tempFilename){
        fs.unlinkSync(tempFilename);
    });
}

function createSingleFile(list, outputFileStr){
    if (d) console.log("Creating single file");
    if(list == null || list == ""){
        console.log("List to merge is not valid. Aborting..");
        return;
    }
    var outputPath = path.dirname(outputFileStr);
    if(!fs.existsSync(outputPath)){
        fs.mkdirSync(outputPath);
    }
    concat(list, outputFileStr).then(result =>
        console.log(outputFileStr + " has been created.")
    );
}

function applyGeneratedContent(origContent, fileOptions) {
    var scrubbedContent = origContent;

    //Remove YAML
    if(fileOptions.noYAML){
        var contentNoYAML = removeYAML(origContent);
        scrubbedContent = contentNoYAML;
    }
    //Allows for find and replace options in the markdown with ${}
    if(fileOptions.replace){
        scrubbedContent = replaceStrings(scrubbedContent,fileOptions.replace);
    }
    //Add TOC
    if(fileOptions.TOC){
        var tocTitle = "#### Module Contents";
        if(fileOptions.TOC.toString().toLowerCase() != "true"){
            tocTitle = fileOptions.TOC
        } 
        // Write TOC with doctoc
        // https://github.com/thlorenz/doctoc
        var outDoctoc = doctoc(scrubbedContent,"github.com",3,tocTitle,false,"",true,true);
        if(outDoctoc.data != null){
            scrubbedContent = outDoctoc.data;
            if (v) console.log("TOC Added");
        }
    } 
    return scrubbedContent;
} 

/** Searches for ![*](relPath) or src="relPath" in a string and replaces the asset
 * relPath with a new relPath based on the output file. 
 * @param {*} fileContents String containing relative paths to update
 * @param {*} inputPath relative input path of fileContents
 * @param {*} outputPath relative output path of output file
 * @returns String that contains updated relative paths to the output file
 */
function updateAssetRelPaths(fileContents,inputPath, outputPath){
    var resultContent=[];
    var regex = /(!\[(.*?)\][(](.*?)[)])|(src=["'](.*?)["'])/g;

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
                //resolve the asset path and create a new relative path to the output
                var origAssetPath = path.resolve(inputPath, origAssetRelPath);
                var newAssetRelPath = path.relative(outputPath,origAssetPath);

                if(v) console.log("origAssetRelPath: "+origAssetRelPath);
                if(v) console.log("newAssetRelPath: "+newAssetRelPath);

                var newLine = line.replace(origAssetRelPath,newAssetRelPath);
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

/** By default keys are expected to be wrapped with <!--{key}--> in the markdown 
 * unless specified in the replacemens json.
 * @param {*} fileContents - String that contains the replaceable characters
 * @param {*} replacements - key value pairs that contain the find/replace values.
 *   Special keys include:
 *     - startStr: replaces the <!--{ start string
 *     - endStr: replaces the }--> end string
 * @returns String that contains the replaced keys with their values
 */
function replaceStrings(fileContents,replacements){
    var replacedContent = fileContents;
    var startStrKey="startStr", endStrKey="endStr";
    var startStr = replacements[startStrKey] || "<!--{";
    var endStr = replacements[endStrKey] || "}-->";
    Object.keys(replacements).forEach(function(replaceKey) {
        var find="",replaceStr="",replace=true;
        var optionValue = replacements[replaceKey];
        if(optionValue){
            find=replaceKey;
            switch(replaceKey) {
                case startStrKey:
                    replace=false;
                    break;
                case endStrKey:
                    replace=false;
                    break;
                case "timestamp":
                    var date_ob = new Date(Date.now());
                    replaceStr = (date_ob.getMonth() + 1) + "-" + date_ob.getDate() + "-" + date_ob.getFullYear()
                    if(typeof optionValue != "boolean" && optionValue.toString() != ""){
                        replaceStr = optionValue;
                    }
                    break;
                default:
                    replaceStr=optionValue;
            }
            if(replace) {
                var findStr = startStr+find+endStr;
                var findRegex = new RegExp(findStr, 'g')
                if(v) console.log("Replacing: "+findRegex+" with: "+replaceStr);
                replacedContent = replacedContent.replace(findRegex,replaceStr);
            }
        }   
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