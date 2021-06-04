var path = require('path')
 ,   fs  =  require('fs')
 , concat = require('concat')
 , markdownLinkCheck = require('markdown-link-check')
, doctoc = require('doctoc/lib/transform');
const { exit } = require('process');

exports.add = function(manifestJSON, relPath, v){
    var verbose = v || false;
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

    //Iterate through all of the files in manifest and:
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
                var tempFile = createTempFile(fileRelPathStr,tocTitle,v);
                fileList.push(tempFile);
            } else {
                console.log("first file, skipping prepare.");
                fileList.push(fileRelPathStr);
            }
            linkCheck(fileRelPathStr,outputLinkcheckFile,v);

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

    console.log("++++++++++++++++++++")
    //Merge lists and output single markdown file
    var mergedFileList = fileList.concat(refFileList);
    console.log("List of files to combine:\n    " + mergedFileList.join("\n    "));
    createSingleFile(mergedFileList, outputFileRelPathStr);

    //Remove temp files
    findFiles('./',/\.temp$/,function(tempFilename){
        fs.unlinkSync(tempFilename);
    });
}

function createSingleFile(list, output, v){
    if (v) console.log("creating single file");
    outputPath = path.dirname(output);
    if(!fs.existsSync(outputPath)){
        fs.mkdirSync(outputPath);
    }
    concat(list, output).then(result =>
        console.log(output + " has been created.")
    );
}

function createTempFile (fileString, tocTitle, v) {
    var tempFile = fileString + ".temp";
    console.log("Preparing file: "+tempFile);
    var origContent = fs.readFileSync(fileString, 'utf-8');
    var scrubbedContent = "";

    //Remove YAML
    var contentNoYAML = removeYAML(origContent, v);
    scrubbedContent = contentNoYAML;
    
    // Write TOC with doctoc
    // https://github.com/thlorenz/doctoc
    var outDoctoc = doctoc(scrubbedContent,"github.com",3,tocTitle,false,"",true,true);
    if(outDoctoc.data != null){
        scrubbedContent = outDoctoc.data;
        console.log("TOC Added");
    }

    fs.writeFileSync(tempFile,scrubbedContent)
    console.log("Ready for merge");
    return tempFile;
} 

//Removes YAML at beginning of file
function removeYAML(fileContents, v) {
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
    // console.log("S("+startYAML+")E("+endYAML+")✓'d("+i+")T("+lines.length+")");
    if(startYAML != -1 && endYAML != -1){
        //shows YAML being removed
        yaml = lines.splice(startYAML,1+endYAML-startYAML).join("\n");
        if(v) console.log("Removing S("+startYAML+")->E("+endYAML+") YAML:")
        if(v) console.log(yaml);
        noYaml = lines.join("\n");
        console.log("YAML removed");
    } else {
        console.log("No YAML found for removal");
    }
    return  noYaml;
}

// function that uses markdown-link-check to validate all URLS and relative links to images
// https://github.com/tcort/markdown-link-check
function linkCheck(relFileStr, outputLinkcheck, v) {
    var contents = fs.readFileSync(relFileStr, 'utf8');
    //TODO Linkcheck doesn't work for devOps. Need investigation
    var base = "file://" + process.cwd();
    console.log("BASE: "+base);
    markdownLinkCheck(contents,
        {
            baseUrl: base+"/..",
            projectbaseUrl: base,
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
