var path = require('path')
 ,   fs  =  require('fs')
 , concat = require('concat')
 , replace = require('gulp-replace')
 , gulp = require('gulp')
 , markdownLinkCheck = require('markdown-link-check')
, doctoc = require('doctoc/lib/transform');

exports.add = function(manifest, outputFile, linkcheckFile, quiet){
    var tocTitle = "#### Module Contents";
    var manifestJSON = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    var listOfFiles = manifestJSON.list;
    var manifestPath = path.dirname(manifest);

    var linkCheckContent = "";
    var refFilesList= [];
    for (var fileKey in listOfFiles){
        var fileStr = listOfFiles[fileKey];
        var filePath = manifestPath +"/"+ fileStr;
        
        console.log("*******************")
        if (fs.existsSync(filePath)){
            console.log(filePath);
            if(fileKey != 0){
                var tempFile = createTempFile(filePath,tocTitle);
                listOfFiles[fileKey] = tempFile;
                console.log(tempFile+" scrubbed for output.");
            } else {
                listOfFiles[fileKey] = filePath;
            }
            //TODO add Linkcheck
            //linkCheckContent+=linkCheck(listOfFiles[fileKey]);

            //Adds any same name .ref.md files to refFilesList
            var refFileStr = filePath.replace(".md",".ref.md")
            if(fs.existsSync(refFileStr)){
                console.log("Including "+refFileStr+ " at end of output");
                refFilesList.push(refFileStr);
            }
        }
        else {
            console.warn(fileStr + " does not exist. Skipping.");
            delete listOfFiles[fileKey];
        }
    }
    //TODO add Linkcheck
    //Write link checker file
    //fs.writeFileSync(linkcheckFile,linkCheckContent);

    //Merge lists and output single markdown file
    var mergedListOfFiles = listOfFiles.concat(refFilesList);
    console.log("List of files to combine: " + mergedListOfFiles);
    createSingleFile(mergedListOfFiles, outputFile);

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
    var scrubbedContent = "";
    
    var origContent = fs.readFileSync(fileString, 'utf-8');
    
    //TODO add removeYAML 
    //Remove YAML
    // var contentNoYAML = removeYAML(content);

    //Write TOC with doctoc
    var outDoctoc = doctoc(origContent,"github.com",3,tocTitle,false,"",true,true);
    scrubbedContent = outDoctoc.data;

    fs.writeFileSync(tempFile,scrubbedContent)
    return tempFile;
} 

//TODO Remove YAML
function removeYAML(fileContents) {
    var YAMLFrontMatter= '/^---[.\r\n]*---/';
    // gulp.src(fileString)
    //     .pipe(replace(YAMLFrontMatter, ''))
    //     .pipe(gulp.dest('./temp'));
    return fileContents;
}

//FIXME Linkcheck is not writing anything
function linkCheck(inputFile) {
    fs.readFile(inputFile, 'utf8' , (err, data) => {
        if (err) {
          console.error(err)
          return
        }
        markdownLinkCheck(data,
            {ignorePatterns: [{ "pattern": "^http://localhost"}]}, 
            function (err, results) {
                if (err) {
                    console.error('Error', err);
                    return;
                }
                results.forEach(function (result) {
                    console.log('%s is %s', result.link, result.status);
                    // fs.writeFileSync(result.status,"linkcheck.md")
                } 
                );
                return results;
        });
    });
}

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
