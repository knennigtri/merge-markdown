var mm = require('../index.js');
var path = require('path');
var nodePandoc = require('node-pandoc');
var wkhtmltopdf = require('wkhtmltopdf');
var doctoc = require('doctoc/lib/transform');
var fs = require('fs');

var DEFAULT_LATEX_TEMPLATE = "template.latex";
var DEFAULT_CSS = "";

var manifest = "";
var mmOutputFileABS = "" ;
var pandocOutputFileABS = "";
var pdfOutputFileABS = ""
var cssFileABS = "";
var latexTemplateABS = "";

var build = function(manifest){

    var manifestABS = path.resolve(manifest);

    var manifestABSPath = path.parse(manifestABS).dir;
    console.log(manifestABS);

    //Grab the built manifest based on the input
    var jsonObj = mm.manifestJSON(manifest);
    var mOutputABSPath = path.parse(jsonObj.output).dir;
    var mOutputFileName = path.parse(jsonObj.output).base;
    var mTitle = path.parse(jsonObj.output).name;

    var outputABSPath = path.join(manifestABSPath,mOutputABSPath);

    var mTitleNoSpaces = mTitle.replace(/ /g,"_");
    mmOutputFileABS = path.join(outputABSPath,mOutputFileName);
    pandocOutputFileABS = path.join(outputABSPath, mTitleNoSpaces + ".html");
    pdfOutputFileABS = path.join(outputABSPath, mTitleNoSpaces + ".pdf");

    if(jsonObj.css){
        console.log("Using css: " + jsonObj.css);
        cssFileABS = path.join(manifestABSPath, jsonObj.css);
    } else {
        console.log("using default css");
        cssFileABS = DEFAULT_CSS;
    }
    if(jsonObj.latexTemplate){
        console.log("Using latex template: " + jsonObj.latexTemplate);
        latexTemplateABS = path.join(manifestABSPath, jsonObj.latexTemplate);
    } else {
        console.log("Using default template.latex");
        latexTemplateABS = DEFAULT_LATEX_TEMPLATE;
    }

    if(cssFileABS && mTitle){
        console.log("Entering build pdf mode...");
    //    mergeMarkdown();
    addTOC();
    } else {
        console.log("manifest MUST have output and css defined.");
    }
}
/*
function mergeMarkdown(){
    console.log("merge-markdown to create single markdown file based on " + manifest);
    mm.mergeWithManifestFile(manifest, false, function (err, result) {
        if (err) console.error('merge-markdown Oh Nos: ',err);
        console.log(mOutputFileName + " created from " + manifest + " file.");
        addTOC();
        return result;
    });
}
*/

async function addTOC(){
    var promise = new Promise((res, rej) => {
        setTimeout(() => res("Now it's done!"), 1000)
    });
    var result = await promise; 
    
    var origContent = fs.readFileSync(mmOutputFileABS, 'utf-8');
    fs.rmSync(mmOutputFileABS);
    var outDoctoc = doctoc(origContent,"github.com",3,"HI",true,"",false,true);
    fs.writeFileSync(mmOutputFileABS, outDoctoc.data, 'utf-8');
    toHTML();
}


function toHTML(){
    console.log("Pandoc creating intermediary HTML...");
    console.log("Expected output: "+ pandocOutputFileABS);
    var pandocArgs = "-c "+cssFileABS+" -o " + pandocOutputFileABS + " --template "+latexTemplateABS+"";
    nodePandoc(mmOutputFileABS, pandocArgs, function (err, result) {
        if (err) {
        console.error('PANDOC Oh Nos: ',err);
        }  
        console.log(path.parse(pandocOutputFileABS).base + " created from " + path.parse(mmOutputFileABS).base);
        toPDF();
        return result;
    });
}

function toPDF(){
    console.log("wkHTMLtoPDF to create PDF...");
    console.log("Expected output: "+ pdfOutputFileABS);
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