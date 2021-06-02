var path = require('path')
 ,   fs  =  require('fs')
 , concat = require('concat')
 , markdownLinkCheck = require('markdown-link-check')
, doctoc = require('doctoc/lib/transform');

exports.add = function(manifestJSON, relPath){
    var tocTitle = "#### Module Contents";
    var quiet = manifestJSON.quiet || false;
    var inputList = manifestJSON.input;
    var outputFileRelPathStr = relPath +"/"+ manifestJSON.output;
    var outputLinkcheckFile = outputFileRelPathStr.replace(".md",".linkcheck.md");
    if(!fs.existsSync(path.dirname(outputFileRelPathStr))){
        fs.mkdirSync(path.dirname(outputFileRelPathStr));
    } else {
        if(fs.existsSync(outputFileRelPathStr)){
            fs.unlinkSync(outputFileRelPathStr);
        }
        if(fs.existsSync(outputLinkcheckFile)){
            fs.unlinkSync(outputLinkcheckFile);
        }
    }

    //Iterate through all of the files in manifest input to:
    // - check all links are valid
    // - remove YAML from all files except the first one
    // - inject a TOC
    // - add all files to an ordered list to be merged
    var fileList= [];
    var refFileList= [];
    for (var inputKey in inputList){
        var fileStr = inputList[inputKey];
        var fileRelPathStr = relPath +"/"+ fileStr;
        
        console.log("*******************")
        if (fs.existsSync(fileRelPathStr)){
            console.log(fileRelPathStr);
            if(inputKey != 0){
                var tempFile = createTempFile(fileRelPathStr,tocTitle);
                console.log(tempFile+" scrubbed for output.");
                fileList.push(tempFile);
            } else {
                fileList.push(fileRelPathStr);
            }
            linkCheck(fileRelPathStr,outputLinkcheckFile,quiet);

            //Adds any same name .ref.md files to refFilesList
            var refFileRelPathStr = fileRelPathStr.replace(".md",".ref.md")
            if(fs.existsSync(refFileRelPathStr)){
                console.log("Including "+refFileRelPathStr+ " at end of output");
                refFileList.push(refFileRelPathStr);
            }
        }
        else {
            console.warn(fileStr + " does not exist. Skipping.");
        }
    }

    //Merge lists and output single markdown file
    var mergedFileList = fileList.concat(refFileList);
    console.log("List of files to combine: " + mergedFileList);
    createSingleFile(mergedFileList, outputFileRelPathStr);

    //Remove temp files
    findFiles('./',/\.temp$/,function(tempFilename){
        fs.unlinkSync(tempFilename);
    });
}

function createSingleFile(list, output){
    console.log("creating single file");
    outputPath = path.dirname(output);
    if(!fs.existsSync(outputPath)){
        fs.mkdirSync(outputPath);
    }
    // fs.unlinkSync(output);
    concat(list, output).then(result =>
        console.log(output + " has been created.")
    );
}

function createTempFile (fileString, tocTitle) {
    var tempFile = fileString + ".temp";
    console.log("File to be created: "+tempFile);
    var origContent = fs.readFileSync(fileString, 'utf-8');
    var scrubbedContent = "";

    //Remove YAML
    var contentNoYAML = removeYAML(origContent);
    scrubbedContent = contentNoYAML;
    
    // Write TOC with doctoc
    // https://github.com/thlorenz/doctoc
    var outDoctoc = doctoc(scrubbedContent,"github.com",3,tocTitle,false,"",true,true);
    if(outDoctoc.data != null){
        scrubbedContent = outDoctoc.data;
    }

    fs.writeFileSync(tempFile,scrubbedContent)
    return tempFile;
} 

//Removes YAML at beginning of file
function removeYAML(fileContents) {
 //   var YAMLFrontMatter= /^---[.\s\S]*---/;
  //  var noYaml = fileContents.replace(YAMLFrontMatter,'');
  var noYaml=fileContents;
    return  noYaml;

    //TODO rewrite noYAML
    //Read in file contents
    //if line 1 is ---, start counting
    //when --- is reached again, stop counting
    //Remove lines between counts
    //Return noYAMLMarkdown
}

// function that uses markdown-link-check to validate all URLS and relative links to images
// https://github.com/tcort/markdown-link-check
function linkCheck(relFileStr, outputLinkcheck, quiet) {
    var contents = fs.readFileSync(relFileStr, 'utf8');
    //TODO Linkcheck doesn't work for devOps. Need investigation
    markdownLinkCheck(contents,
        {
            baseUrl: 'file://' + process.cwd(),
            ignorePatterns: [{ pattern: "^http://localhost" }],
        }, function (err, results) {
            if (err) {
                console.error('Error', err);
                return;
            }
            linkcheckResults= "FILE: " + relFileStr + " \n";
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
                //TODO implement -q quiet
                if(result.status != "alive"){
                    linkcheckResults+=" ["+icon+"] " + result.link + " is " + result.status + " \n";
                }
            });
            linkcheckResults+="\n "+results.length +" links checked. \n\n  \n";
            if(fs.existsSync(outputLinkcheck)){
                fs.appendFileSync(outputLinkcheck,linkcheckResults);
            }else{
                fs.writeFileSync(outputLinkcheck,linkcheckResults);
            }
    });
}

// Helper method to find all .temp files and do something with them
function findFiles(startPath,filter,callback){
    //console.log('Starting from dir '+startPath+'/');

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
