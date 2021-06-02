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

    var linkCheckContent = "";
    var refFilesList=" ";
    for (var fileKey in listOfFiles){
        var fileStr = listOfFiles[fileKey];
        
        console.log("*******************")
        if (fs.existsSync(fileStr)){
            console.log(fileStr);
            if(fileKey != 0){
                var tempFile = createTempFile(fileStr);
                listOfFiles[fileKey] = tempFile;
                console.log(tempFile+" scrubbed for output.");
            }
            linkCheckContent+=linkCheck(listOfFiles[fileKey]);

            //Adds any same name .ref.md files to refFilesList
            var refFileStr = fileStr.replace(".md",".ref.md")
            if(fs.existsSync(refFileStr)){
                console.log("Including "+refFileStr+ " at end of output");
                refFilesList+=" "+refFileStr;
            }
        }
        else {
            console.warn(fileStr + " does not exist. Skipping.");
            delete listOfFiles[fileKey];
        }
    }
    fs.writeFileSync(linkcheckFile,linkCheckContent);

    //add all .ref.md files
    listOfFiles+=refFilesList;
    console.log("List of files to combine: " + listOfFiles);

    //works
  //  createSingleFile(listOfFiles, outputFile);

    findFiles('./',/\.temp$/,function(tempFilename){
        fs.unlinkSync(tempFilename);
    });
    
}

function createTempFile (fileString, tocTitle) {
    var tempFile = fileString + ".temp";
    var scrubbedContent = "";
    
    fs.readFile(fileString, 'utf8' , (err, content) => {
        if (err) {
          console.error(err)
          return
        }

        //Remove YAML
       // var contentNoYAML = removeYAML(content);
       
        // console.log(content);
        //Write TOC with doctoc
        var outDoctoc = doctoc(content,"github.com",3,tocTitle,false,"","",true);
        console.log(outDoctoc);
        scrubbedContent = outDoctoc.data;
      });
      fs.writeFileSync(tempFile,scrubbedContent);

    return tempFile;
} 

//TODO not working.
function removeYAML(fileContents) {
    var YAMLFrontMatter= '/^---[.\r\n]*---/';
    // gulp.src(fileString)
    //     .pipe(replace(YAMLFrontMatter, ''))
    //     .pipe(gulp.dest('./temp'));
    return fileContents;
}

//TODO not writing anything
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

//TODO
function findAllRefFiles(fileMap, regexStr){
    return "";
}

function createSingleFile(list, output){
    fs.unlink(output, (err) => {
        concat(list, output);
        console.log(output + " has been created.");
    })
}

//TODO
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
