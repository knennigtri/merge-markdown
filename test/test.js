"use strict";
var init = require("../src/index.js");
var minimist = require("minimist");
var args = minimist(process.argv.slice(3));
const fs = require("fs");
const path = require("path");


test(args.hideconsole);

async function test(hideconsole) {
  // Hide console logs
  if (hideconsole) {
    console.log = function () { };
  }
  var errors = 0;
  var errArr = [];

  /*
  TEST - merging files in manifests
 [manifestFile, qaMode, skip_linkcheck, maintainAssetPaths, presentationType, producesError] 
 */
  var mergeArr = [];
  mergeArr.push( // Test different manifests
    ["test/markdown/src/myManifest.yml", false, false, false, "pdf", 0],
    ["test/markdown/src/myManifest.json", false, false, false, "pdf", 0],
    ["test/pdf/src/myManifest.yml", false, false, false, "pdf", 0],
    ["test/pdf/src/manifest-noPresentation.yml", false, false, false, "pdf", 0],
    ["test/pdf/src/myManifest.yml", false, false, false, "html", 0],
    ["test/pdf/src/manifest-noPresentation.yml", false, false, false, "html", 0]
  );
  mergeArr.push( // Test different params
    ["test/markdown/src/myManifest.yml", true, false, false, "pdf", 0],
    ["test/markdown/src/myManifest.yml", false, true, false, "pdf", 0],
    ["test/markdown/src/myManifest.yml", false, false, true, "pdf", 0],
  );
  mergeArr.push( // Test IO missing
    ["test/markdown/src/manifests/manifest-noIO.yml", false, false, false, 1],
    ["test/markdown/src/manifests/manifest-noInput.yml", false, false, false, 1],
    ["test/markdown/src/manifests/manifest-noOutput.yml", false, false, false, 1]
  );
  for (var i = 0; i < mergeArr.length; i++) {
    try {
      // (manifestParam, qaParam, noLinkcheckParam, maintainAssetPaths)
      console.log(mergeArr[i][0]);
      init.merge.start(mergeArr[i][0], mergeArr[i][1], mergeArr[i][2], mergeArr[i][3]);
      var promise = new Promise(res => {
        setTimeout(() => res("Now it's done!"), 500);
      });
      await promise;
    } catch (err) {
      console.log(err);
      if (mergeArr[i][mergeArr.length - 1]) {
        errors++;
        errArr.push(["==merge.start==", mergeArr[i]]);
      }
    }
  }

  /*
 TEST - merging files in manifests
[folderDirectory, producesError] 
*/
  var createArr = [];
  createArr.push(
    ["test/markdown/src", 0],
    ["test/yaml-test", 0],
    ["test/pdf", 0]
  );
  for (var j = 0; j < createArr.length; j++) {
    try {
      init.manifestUtil.createManifestFile(createArr[j][0]);
    } catch (err) {
      errors++;
      if (createArr[j][createArr.length - 1]) {
        console.log(err);
        errArr.push(["==manifest.create==", createArr[j]]);
      }
    }
  }

  fs.unlink("./manifest.yml", (err) => {
    if (err) console.error("Error deleting testing file:", err);
  });

  //TODO write tests for pdf/html output
  //TODO write tests for docker

  console.error("Total errors in testing: " + errors);
  for (var k = 0; k < errArr.length; k++) {
    console.error("  [" + errArr[k] + "]");
  }
  deleteFoldersAndFiles("test/");
}

function deleteFoldersAndFiles(directoryPath) {
  const foldersToDelete = ["merged", "target"];
  const filesToDelete = ["docker-compose.yml", "Dockerfile"];

  // Function to recursively delete folders and files
  function deleteRecursively(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        deleteRecursively(filePath); // Recursively delete subfolders
      } else {
        // Check if the file matches the ones to delete
        if (filesToDelete.includes(file)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted file: ${filePath}`);
        }
      }
    });

    // Check if the current directory matches the ones to delete
    if (foldersToDelete.includes(path.basename(dir))) {
      fs.rmSync(dir, { recursive: true });
      console.log(`Deleted folder: ${dir}`);
    }
  }

  // Start recursively deleting folders and files
  deleteRecursively(directoryPath);
}