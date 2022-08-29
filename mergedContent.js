var mm = require('./index.js');
var path = require('path');
var nodePandoc = require('node-pandoc');
var wkhtmltopdf = require('wkhtmltopdf');
var doctoc = require('doctoc/lib/transform');
var fs = require('fs');

var manifest = "";
var mTitle = "";
var mmOutputFileABS = "" ;
var pandocOutputFileABS = "";
var pdfOutputFileABS = ""
var cssFileABS = "";
var latexTemplateABS = "";

var build = async function(manifest, mode, argDebug, argVerbose){

    var manifestABS = path.resolve(manifest);

    var manifestABSPath = path.parse(manifestABS).dir;
    console.log(manifestABS);

    //Grab the built manifest based on the input
    var jsonObj = mm.manifestJSON(manifest);
    var mOutputABSPath = path.parse(jsonObj.output).dir;
    var mOutputFileName = path.parse(jsonObj.output).base;
    mTitle = path.parse(jsonObj.output).name;

    var outputABSPath = path.join(manifestABSPath,mOutputABSPath);

    var mTitleNoSpaces = mTitle.replace(/ /g,"_");
    mmOutputFileABS = path.join(outputABSPath,mOutputFileName);
    pandocOutputFileABS = path.join(outputABSPath, mTitleNoSpaces + ".html");
    pdfOutputFileABS = path.join(outputABSPath, mTitleNoSpaces + ".pdf");

    if(jsonObj.css){
        cssFileABS = path.join(manifestABSPath, jsonObj.css);
    }
    if(jsonObj.latexTemplate){
        latexTemplateABS = path.join(manifestABSPath, jsonObj.latexTemplate);
    }
    var promise = new Promise((res, rej) => {
        setTimeout(() => res("Now it's done!"), 500)
    });
    await promise; 

    toHTML(mode);
}

function toHTML(mode){
    var pandocArgs = buildPandocArgs(mPandocParams, pandocOutputFileABS);
    nodePandoc(mmOutputFileABS, pandocArgs, function (err, result) {
        if (err) {
        console.error('PANDOC Oh Nos: ',err);
        }  
        console.log(path.parse(pandocOutputFileABS).base + " created from " + path.parse(mmOutputFileABS).base);
        if(mode == 'pdf') toPDF();
        return result;
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

//TODO test this
function buildPandocArgs(jsonObj, fileName){
    var cliArgs = "";
    defaultOut = "-o " + fileName;
    Objects.keys(jsonObj).forEach(function eachKey(key) { 
        cliArgs += " " + jsonObj[key];
    });
    //if no specified output name was given, use the default
    if(!cliArgs.includes("-o")){
        cliArgs += " " + defaultOut;
    }
    if(debug) console.log("Pandoc Args: " + cliArgs);
    return cliArgs;
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
    if(debug) console.log("wkhtmltopdf Args: " + JSON.stringify(options));
    return options;
}

function renameToFinalTitle(){
    fs.rename(pdfOutputFileABS, mTitle+".pdf",  () => {
        console.log("File Renamed to " + path.parse(pdfOutputFileABS).base);
      });
}

exports.build = build;