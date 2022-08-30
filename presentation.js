var path = require('path');
var nodePandoc = require('node-pandoc');
var wkhtmltopdf = require('wkhtmltopdf');
var debug = require('debug')('presentation');
var debugHTML = require('debug')('presentation:html');
var debugHTMLOptions = require('debug')('presentation:html:options');
var debugPDF = require('debug')('presentation:pdf');
var debugPDFOptions = require('debug')('presentation:pdf:options');
var verbose = require('debug')('verbose');
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

    //TODO remove?
    var promise = new Promise((res, rej) => {
        setTimeout(() => res("Now it's done!"), 500)
    });
    await promise; 

    toHTML(jsonObj, absMMFileName, absInputPath, mode);
}

/**
 * Input and Output files are expected to be ABS
 */
function toHTML(manifestJson, inputFile, inputPath, mode){
    debug("Creating HTML...")
    var outputFile = path.parse(inputFile).dir + "/temp.html";
    var pandocArgs = buildPandocArgs(manifestJson.pandoc, inputPath, outputFile);
    debugHTML("input: "+inputFile);
    debugHTML("Args: "+pandocArgs);
    nodePandoc(inputFile, pandocArgs, function (err, result) {
        if (err) {
            console.error('PANDOC Oh Nos: ',err);
        } else {
            console.log(path.parse(outputFile).base + " created from " + path.parse(inputFile).base);
            switch (mode){
                case MODE.pdf:
                    toPDF(manifestJson, outputFile, mode);
                    break;
                case MODE.html:
                    renameToManifestOutputName(manifestJson, outputFile, mode);
                    break;
                default:
                    return;
            }
            verbose(result);
        }
    });
}

/**
 * Input and Output files are expected to be ABS
 */
function toPDF(manifestJson, inputFile, mode){
    debug("Creating PDF...")
    var outputFile = path.parse(inputFile).dir + "/temp.pdf";
    var options = buildWkhtmltopdfOptions(manifestJson.wkhtmltopdf, outputFile);
    debugPDF("input: "+inputFile);
    debugPDF("Args: "+JSON.stringify(options));
    wkhtmltopdf(fs.createReadStream(inputFile), options, function (err, result) {
        if (err) {
            console.error('WKHTMLTOPDF Oh Nos: ',err);
        } else {
            console.log(path.parse(outputFile).base + " created from " + path.parse(inputFile).base);
            renameToManifestOutputName(manifestJson, outputFile, mode);
            // fs.unlinkSync(inputFile);
            verbose(result);
        }
    });
}

function buildPandocArgs(jsonObj, inputPath, fileName){
    var cliArgs = "-o" + fileName;
    if(jsonObj){
        for (var key in jsonObj){
            if (jsonObj.hasOwnProperty(key)) {
                if(jsonObj[key].includes("--template")){
                    var templatePath = jsonObj[key].substring(jsonObj[key].indexOf(" ") + 1);
                    templatePath = path.join(inputPath,templatePath);
                    debugHTMLOptions("template added: " + templatePath);
                    cliArgs += " --template " + templatePath;
                } else if(jsonObj[key].includes("-c")){
                    var ccsPath = jsonObj[key].substring(jsonObj[key].indexOf(" ") + 1);
                    ccsPath = path.join(inputPath,ccsPath); 
                    debugHTMLOptions("css added: " + ccsPath);
                    cliArgs += " -c " +ccsPath;
                } else if(jsonObj[key].includes("-o")){
                    debugHTMLOptions("Arg [ -o ] cannot be changed. Ignoring.");
                } else {
                    debugHTMLOptions("Arg [ "+jsonObj[key]+" ] added.")
                    cliArgs += " " + jsonObj[key];
                }
            }
        };
        //add default title if none was given
        if(!cliArgs.includes("-M")) cliArgs += " -M title:defaultTitle";
    } else {
        cliArgs += " -M title:defaultTitle";
        debugHTML("No pandoc Args given in manifest. Using arguments: " + cliArgs);
    }
    return cliArgs;
}

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
                    case 'output':
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

function renameToManifestOutputName(manifestJson, inputFile, mode){
    var title = path.parse(manifestJson.output).name;
    var output = path.parse(inputFile).dir;
    if(mode == MODE.pdf){
        output = path.join(output, title + EXT.pdf)
    }
    if(mode == MODE.html){
        output = path.join(output, title + EXT.html)
    }
    fs.rename(inputFile, output,  () => {
        console.log("File Renamed to " + path.parse(output).base);
    });
}

exports.build = build;