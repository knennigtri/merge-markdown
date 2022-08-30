var mm = require('./index.js');
var path = require('path');
var nodePandoc = require('node-pandoc');
var wkhtmltopdf = require('wkhtmltopdf');
var doctoc = require('doctoc/lib/transform');
var debug = require('debug')('presentation');
var debugHTML = require('debug')('presentation:html');
var debugPDF = require('debug')('presentation:pdf');
var debugPDFOptions = require('debug')('presentation:pdf:options');
var fs = require('fs');
var EXT = {
    "pdf": ".pdf",
    "html": ".html"
}
var MODE = {
    "pdf": "pdf",
    "html": "html"
}
exports.MODE = MODE;

var build = async function(jsonObj, inputPath, mode){
    debug("Presentation output: " + mode);
    var absInputPath = path.resolve(inputPath);

    // var manifestABSPath = path.parse(inputPath).dir;
    debug("Input: " + absInputPath);

    //Set the output location of documents
    var absManifestOutputPath = path.parse(jsonObj.output).dir;
    var absManifestOutputFileName = path.parse(jsonObj.output).base;
    var absOutputPath = path.join(absInputPath,absManifestOutputPath);
    //Location of merge-markdown file
    var absMMFileName = path.join(absOutputPath,absManifestOutputFileName);
    
    //Setup the title of the output documents
    var mTitle = path.parse(jsonObj.output).name;
    var mTitleNoSpaces = mTitle.replace(/ /g,"_");

    //Default name used for all output documents
    var absOutputFileName = path.join(absOutputPath, mTitleNoSpaces + EXT.html);

    //TODO remove?
    var promise = new Promise((res, rej) => {
        setTimeout(() => res("Now it's done!"), 500)
    });
    await promise; 

    toHTML(jsonObj, absMMFileName, absOutputFileName, mode);
}

/**
 * Input and Output files are expected to be ABS
 */
function toHTML(manifestJson, inputFile, outputFile, mode){
    debug("Creating HTML...")
    var pandocArgs = buildPandocArgs(manifestJson.pandoc, outputFile);
    debugHTML("input: "+inputFile);
    debugHTML("Args: "+pandocArgs);
    nodePandoc(inputFile, pandocArgs, function (err, result) {
        if (err) {
            console.error('PANDOC Oh Nos: ',err);
        } else {
            console.log(path.parse(outputFile).base + " created from " + path.parse(inputFile).base);
            if(mode == MODE.pdf){
                var absPDFName = outputFile.replace(EXT.html,EXT.pdf);
                toPDF(manifestJson, outputFile, absPDFName, mode);
            }
        }
    });
}

/**
 * Input and Output files are expected to be ABS
 */
function toPDF(manifestJson, inputFile, outputFile, mode){
    debug("Creating PDF...")
    var options = buildWkhtmltopdfOptions(manifestJson.wkhtmltopdf, outputFile);
    debugHTML("input: "+inputFile);
    debugHTML("Args: "+JSON.stringify(options));
    return;
    wkhtmltopdf(fs.createReadStream(inputFile), options, function (err, result) {
        if (err) {
            console.error('WKHTMLTOPDF Oh Nos: ',err);
        } else {
            console.log(path.parse(outputFile).base + " created from " + path.parse(inputFile).base);
           // renameToFinalTitle();
           debugPDF(result);
        }
    });
}

function buildPandocArgs(jsonObj, fileName){
    fileName = fileName || "default-name";
    var cliArgs = "";
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
            cliArgs += " -o" + fileName;
        }
        //remove leading space
        if(cliArgs.charAt(0) == " ") cliArgs = cliArgs.substring(1);
    } else {
        cliArgs = "-o " + fileName + " -M title:defaultTitle";
        debugHTML("No pandoc Args given in manifest. Using Default pandoc arguments: " + cliArgs);
    }
    return cliArgs;
}

//TODO test this
function buildWkhtmltopdfOptions(optionsJson, fileName){
    debugPDF("Adding wkhtmltopdf options from Manifest");
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
    if(optionsJson){
        for (var key in optionsJson){
            if(optionsJson.hasOwnProperty(key)){
                switch (key) {
                    case 'output':
                        options.output = optionsJson[key];
                        debugPDFOptions("Option [ "+key+" ] added.");
                        break;
                    case 'marginBottom':
                    case 'B':
                        options.marginBottom = optionsJson[key];
                        debugPDFOptions("Option [ "+key+" ] added.");
                        break;
                    case 'marginTop':
                    case 'T':
                        options.marginTop = optionsJson[key];
                        debugPDFOptions("Option [ "+key+" ] added.");
                        break;
                    case 'marginLeft':
                    case 'L':
                        options.marginLeft = optionsJson[key];
                        debugPDFOptions("Option [ "+key+" ] added.");
                        break;
                    case 'marginRight':
                    case 'R':
                        options.marginRight = optionsJson[key];
                        debugPDFOptions("Option [ "+key+" ] added.");
                        break;
                    case 'pageSize':
                        options.pageSize = optionsJson[key];
                        debugPDFOptions("Option [ "+key+" ] added.");
                        break;
                    case 'footerLine':
                        options.footerLine = optionsJson[key];
                        debugPDFOptions("Option [ "+key+" ] added.");
                        break;
                    case 'footerCenter':
                        options.footerCenter = optionsJson[key];
                        debugPDFOptions("Option [ "+key+" ] added.");
                        break;
                    case 'enableLocalFileAccess':
                    case 'disableSmartShrinking':
                        debugPDFOptions("Option [ "+key+" ] cannot be changed for output. Ignoring.");
                        break;
                    default:
                        options[key] = optionsJson[key];
                        debugPDFOptions("Option [ "+key+" ] added.");
                }
            }
        };
    } else {
        debugPDF("No options given in manifest. Using Default wkhtmltopdf options.");
    }
    return options;
}

function renameToFinalTitle(){
    fs.rename(pdfOutputFileABS, mTitle+".pdf",  () => {
        console.log("File Renamed to " + path.parse(pdfOutputFileABS).base);
      });
}

exports.build = build;