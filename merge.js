var path = require('path'),
fs  =  require('fs'),
concat = require('concat'),
markdownLinkCheck = require('markdown-link-check'),
doctoc = require('doctoc/lib/transform');

exports.add = function(manifestJSON, relPathManifest, v,d,qa){
    var verbose = v || false;
    var debug = d || false;
    var onlyQA = qa || false;
    var inputJSON = manifestJSON.input;
    var outputFileStr = relPathManifest +"/"+ manifestJSON.output;
    var outputLinkcheckFileStr = outputFileStr.replace(".md",".linkcheck.md");
    var outputQAFileStr = outputFileStr.replace(".md",".qa.md");

    //Iterate through all of the input files in manifest apply options
    var fileArr= [];
    var refFileArr= [];
    Object.keys(inputJSON).forEach(function(inputKey) {
        var inputFileStr = relPathManifest +"/"+ inputKey;
        console.log("*********"+inputFileStr+"*********");

        if (!fs.existsSync(inputFileStr)){
            console.warn(inputKey + " does not exist. Skipping.");
        } else {
            var origContent = fs.readFileSync(inputFileStr, 'utf-8');
            //applies gobal generate rules
            if (v) console.log("--applying manifest options--");
            var generatedContent = applyGeneratedContent(origContent,manifestJSON,verbose,debug);
            //Applies file specific generate rules
            if (v) console.log("--applying file options--");
            generatedContent = applyGeneratedContent(generatedContent,inputJSON[inputKey],verbose,debug);
            var tempFile = inputFileStr+".temp";
            fs.writeFileSync(tempFile,generatedContent);
            
            //checks for broken links within the content
            linkCheck(inputFileStr,outputLinkcheckFileStr,verbose,debug);

            //add the  temp file to the list to merge together
            fileArr.push(tempFile);
            console.log(path.basename(tempFile)+" added to merge list");

            //Adds any same name .ref.md files to refFilesList
            var refFileStr = inputFileStr.replace(".md",".ref.md")
            if(fs.existsSync(refFileStr)){
                console.log(path.basename(refFileStr)+ " added to references merge list");
                refFileArr.push(refFileStr);
            }
        }
    });

    console.log("++++++++++++++++++++")
    //Merge lists and output single markdown file
    var mergedFileArr = fileArr.concat(refFileArr);
    
    if(onlyQA){
        var qaFileArr = removeMatching(mergedFileArr, manifestJSON.qa.exclude)
        console.log("List of QA files to merge:\n    " + qaFileArr.join("\n    "));
        createSingleFile(qaFileArr, outputQAFileStr,verbose,debug);
    } else {
        console.log("List of files to merge:\n    " + mergedFileArr.join("\n    "));
        createSingleFile(mergedFileArr, outputFileStr,verbose,debug);
    }

    //Remove temp files
    findFiles('./',/\.temp$/,function(tempFilename){
        fs.unlinkSync(tempFilename);
    });
}

function createSingleFile(list, outputFileStr, v,d){
    if (d) console.log("Creating single file");
    if(list == null || list == ""){
        console.log("List to merge is not valid. Aborting..");
        return;
    }
    outputPath = path.dirname(outputFileStr);
    if(!fs.existsSync(outputPath)){
        fs.mkdirSync(outputPath);
    }
    concat(list, outputFileStr).then(result =>
        console.log(outputFileStr + " has been created.")
    );
}

function applyGeneratedContent(origContent, fileOptions, v,d) {
    var scrubbedContent = origContent;
    //Remove YAML
    if(fileOptions.noYAML){
        var contentNoYAML = removeYAML(origContent, v,d);
        scrubbedContent = contentNoYAML;
    }
    //Add TOC
    if(fileOptions.TOC){
        tocTitle = "#### Module Contents";
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
    //Allows for find and replace options in the markdown with ${}
    if(fileOptions.replace){
        scrubbedContent = replaceStrings(scrubbedContent,fileOptions.replace,v,d);
    }
    return scrubbedContent;
} 

//Removes YAML at beginning of file
function removeYAML(fileContents, v,d) {
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
        yaml = lines.splice(startYAML,1+endYAML-startYAML).join("\n");
        if(d) console.log("Removing S("+startYAML+")->E("+endYAML+") YAML:")
        if(d) console.log(yaml);
        noYaml = lines.join("\n");
        if (v) console.log("YAML removed");
    } else {
        if (v) console.log("No YAML found for removal");
    }
    return  noYaml;
}

function replaceStrings(fileContents,replacements,v,d){
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
                    date_ob = new Date(Date.now());
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
                if(v) console.log("Replacing: "+findStr+" with: "+replaceStr);
                replacedContent = replacedContent.replace(findStr,replaceStr);
            }
        }   
    });
    return replacedContent;
}

// function that uses markdown-link-check to validate all URLS and relative links to images
// https://github.com/tcort/markdown-link-check
function linkCheck(inputFileStr, outputFileStr, v,d) {
    var outputFolder = path.dirname(outputFileStr)
    if(!fs.existsSync(outputFolder)){
        fs.mkdirSync(outputFolder);
    } else {
        if(fs.existsSync(outputFileStr)){
            fs.unlinkSync(outputFileStr);
        }
    }
    
    var inputFolder = path.dirname(inputFileStr);
    base = path.join("file://",process.cwd(),inputFolder);
    if(d) console.log("Input Folder Location: "+base);
    var inputContent = fs.readFileSync(inputFileStr, 'utf-8');
    markdownLinkCheck(inputContent,
        {
            baseUrl: base,
            ignorePatterns: [{ pattern: "^http://localhost" }],
        }, function (err, results) {
            if (err) {
                console.error('Error', err);
                return;
            }
            linkcheckResults= "FILE: " + inputFileStr + " \n";
            if(d) console.log(linkcheckResults);
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
                if(d) console.log(statusStr);
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
};

function removeMatching(originalArray, excludeStr, v,d) {
    var j = 0;
    if (d) console.log("Regex: "+excludeStr);
    var regex = new RegExp(excludeStr);
    while (j < originalArray.length) {
        if (regex.test(originalArray[j])){
            if (d) console.log("RegEx Hit on: " + originalArray[j]);
            originalArray.splice(j, 1);
        } else {
            j++;
        }
    }
    return originalArray;
}
