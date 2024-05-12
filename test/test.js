"use strict";
var init = require("../index.js");
var minimist = require("minimist");
var args = minimist(process.argv.slice(3));

test(args.hideconsole);

async function test(hideconsole){
  var arr = [];

  // Test json and yaml manifests
  arr.push(
    ["test/markdown/src/manifest.json", false, "", false, false],
    ["test/markdown/src/manifest.yml", false, "", false, false]
  );
  // Test IO missing
  arr.push(
    ["test/markdown/src/manifests/manifest-noIO.yml", false, "", false, false],
    ["test/markdown/src/manifests/manifest-noInput.yml", false, "", false, false],
    ["test/markdown/src/manifests/manifest-noOutput.yml", false, "", false, false]
  );
  // Test only folders as manifest
  arr.push(
    ["test/markdown/src", false, "", false, false],
    ["test/yaml-test", false, "", false, false],
  );
  // Test pdf and html generation
  arr.push(
    ["test/pdf/src/manifest.yml", false, "pdf", false, false],
    ["test/pdf/src/manifest-noPresentation.yml", false, "pdf", false, false],
    ["test/pdf/src/manifest.yml", false, "html", false, false],
    ["test/pdf/src/manifest-noPresentation.yml", false, "html", false, false]
  );

  // Hide console logs
  if(hideconsole){
    console.log = function() {};
  }
  var errors = 0;
  var errArr = [];
  for(var i = 0; i < arr.length; i++){
    try{ 
      // (manifestParam, qaParam, modeParam, noLinkcheckParam, maintainAssetPaths)
      init.merge.start(arr[i][0],arr[i][1],arr[i][2],arr[i][3],arr[i][4]);
      var promise = new Promise(res => {
        setTimeout(() => res("Now it's done!"), 500);
      });
      await promise; 
    } catch (err) {
      errors++;
      errArr.push(arr[i]);
    }
  }
  console.error("Total errors in testing: " + errors);
  for(var j = 0; j < errArr.length; j++){
    console.error("  [" + errArr[j] + "]");
  }
}