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

var build = async function(manifest, mode){

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
    var pandocArgs = "-o " + pandocOutputFileABS;
    if(cssFileABS){
        pandocArgs += " -c "+cssFileABS;
    }
    if(latexTemplateABS){
        pandocArgs += " --template "+latexTemplateABS;
    }
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
    var options = {
        output: pdfOutputFileABS,
        B: "1in",
        T: "1in",
        L: ".7in",
        R: ".7in",
        s: "Letter",
        footerLine: true,
        footerCenter: "Page [page]",
        enableLocalFileAccess: true,
        disableSmartShrinking: true
    }
    // TODO currently it's outputting the pdf into the working directory rather than the absolute directory.
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

function renameToFinalTitle(){
    fs.rename(pdfOutputFileABS, mTitle+".pdf",  () => {
        console.log("File Renamed to " + path.parse(pdfOutputFileABS).base);
      });
}

exports.build = build;