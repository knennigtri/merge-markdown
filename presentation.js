var mm = require('./index.js');
var path = require('path');
var nodePandoc = require('node-pandoc');
var wkhtmltopdf = require('wkhtmltopdf');
var doctoc = require('doctoc/lib/transform');
var debug = require('debug')('presentation');
var debugHTML = require('debug')('presentation:html');
var debugPDF = require('debug')('presentation:pdf');
var fs = require('fs');

var build = async function(jsonObj, inputPath, mode){
    debug("Presentation output: " + mode);
    var absInputPath = path.resolve(inputPath);

    // var manifestABSPath = path.parse(inputPath).dir;
    debug("Input: " + absInputPath);

    //Parse output from manifest object
    var absManifestOutputPath = path.parse(jsonObj.output).dir;
    var absManifestOutputFileName = path.parse(jsonObj.output).base;
    var mTitle = path.parse(jsonObj.output).name;

    //Set output location
    var absOutputPath = path.join(absInputPath,absManifestOutputPath);

    var mTitleNoSpaces = mTitle.replace(/ /g,"_");
    var mmOutputFileABS = path.join(absOutputPath,absManifestOutputFileName);
    var absHTMLOutput = path.join(absOutputPath, mTitleNoSpaces + ".html");

    //TODO remove?
    var promise = new Promise((res, rej) => {
        setTimeout(() => res("Now it's done!"), 500)
    });
    await promise; 

    toHTML(mode, mmOutputFileABS, absHTMLOutput, jsonObj.pandoc);
}

function toHTML(mode, absInputFileName, absOutputFileName, mPandocParams){
    debug("Creating HTML...")
    var pandocArgs = buildPandocArgs(mPandocParams, absOutputFileName);
    debugHTML("input: "+absInputFileName);
    debugHTML("Args: "+pandocArgs);
    nodePandoc(absInputFileName, pandocArgs, function (err, result) {
        if (err) {
            console.error('PANDOC Oh Nos: ',err);
        } else {
            console.log(path.parse(absOutputFileName).base + " created from " + path.parse(absInputFileName).base);
            if(mode == 'pdf'){
                var absPDFName = absOutputFileName.replace(".html",".pdf");
                debugHTML("to PDF");
                // toPDF(mode,input, absPDFName);
            }
            return result;
        }
    });
}

function toPDF(){
    var options = buildWkhtmltopdfOptions(mPandocParams, pdfOutputFileABS);
    wkhtmltopdf(fs.createReadStream(pandocOutputFileABS), options, function (err, result) {
        if (err) {
        console.error('WKHTMLTOPDF Oh Nos: ',err);
        }  
        console.log(path.parse(pdfOutputFileABS).base + " created from " + path.parse(pandocOutputFileABS).base);
        // console.log(result);
        renameToFinalTitle();
        return result;
    });
}

function buildPandocArgs(jsonObj, absFileName){
    absFileName = absFileName || "default-name";
    var cliArgs = "";
    defaultOut = "-o " + absFileName;
    if(jsonObj){
        for (var key in jsonObj){
            if (jsonObj.hasOwnProperty(key)) {
                if(jsonObj[key].includes("--template")){
                 var templatePath = jsonObj[key].substring(jsonObj[key].indexOf(" ") + 1);
                 templatePath = path.resolve(templatePath); 
                 debugHTML("template: " + templatePath);
                 cliArgs += " --template " + templatePath;
                } else if(jsonObj[key].includes("-c")){
                    var ccsPath = jsonObj[key].substring(jsonObj[key].indexOf(" ") + 1);
                    ccsPath = path.resolve(ccsPath); 
                    debugHTML("css: " + ccsPath);
                    cliArgs += " -c " +ccsPath;
                } else {
                    cliArgs += " " + jsonObj[key];
                }
            }
        };
        //if no specified output name was given, use the default
        if(!cliArgs.includes("-o")){
            cliArgs += " " + defaultOut;
        }
        if(cliArgs.charAt(0) == " ") cliArgs = cliArgs.substring(1);
        return cliArgs;
    } else {
        return "-o " + absFileName + " -M title:defaultTitle";
    }
}

//TODO test this
function buildWkhtmltopdfOptions(jsonObj, fileName){
    var options = {
        output: fileName,
        enableLocalFileAccess: true,
        disableSmartShrinking: true,
        marginBottom: "1in",
        marginTop: "1in",
        marginLeft: ".7in",
        marginRight: ".7in",
        pageSize: "Letter",
        footerLine: true,
        footerCenter: "Page [page]"
    }
    Objects.keys(jsonObj).forEach(function eachKey(key) { 
        if(key == 'output'){
            options.output = jsonObj[key];
        }
        if(key == 'marginBottom' || key == 'B'){
            options.marginBottom = jsonObj[key];
        }
        if(key == 'marginTop' || key == 'T'){
            options.marginBottom = jsonObj[key];
        }
        if(key == 'marginLeft' || key == 'L'){
            options.marginBottom = jsonObj[key];
        }
        if(key == 'marginRight' || key == 'R'){
            options.marginBottom = jsonObj[key];
        }
        if(key == 'pageSize' || key == 's'){
            options.marginBottom = jsonObj[key];
        }
        if(key == 'footerLine'){
            options.marginBottom = jsonObj[key];
        }
        if(key == 'footerCenter'){
            options.marginBottom = jsonObj[key];
        }
    });
    debugPDF("wkhtmltopdf Args: " + JSON.stringify(options));
    return options;
}

function renameToFinalTitle(){
    fs.rename(pdfOutputFileABS, mTitle+".pdf",  () => {
        console.log("File Renamed to " + path.parse(pdfOutputFileABS).base);
      });
}

exports.build = build;