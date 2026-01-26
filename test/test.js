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
  var testsPassed = 0;
  var testsFailed = 0;

  console.log("\n========================================");
  console.log("Starting Merge-Markdown Test Suite");
  console.log("========================================\n");

  /*
  TEST - Valid Manifests (should complete successfully)
  [manifestFile, qaMode, skip_linkcheck, maintainAssetPaths, expectError] 
  */
  console.log(">>> Testing Valid Manifests");
  var validManifests = [];
  validManifests.push(
    ["test/src/manifest-markdown.yml", false, false, false, 0],
    ["test/src/manifest-presentation.yml", false, false, false, 0]
  );
  
  for (var i = 0; i < validManifests.length; i++) {
    try {
      console.log(`  Testing: ${validManifests[i][0]}`);
      await init.merge.start(validManifests[i][0], validManifests[i][1], validManifests[i][2], validManifests[i][3]);
      var promise = new Promise(res => {
        setTimeout(() => res("Done"), 500);
      });
      await promise;
      
      if (validManifests[i][4] === 0) {
        console.log(`  ✓ PASS: ${validManifests[i][0]}`);
        testsPassed++;
      } else {
        console.log(`  ✗ FAIL: ${validManifests[i][0]} - Expected error but succeeded`);
        errors++;
        testsFailed++;
        errArr.push(["Valid Manifests", validManifests[i][0], "Expected error but succeeded"]);
      }
    } catch (err) {
      if (validManifests[i][4] === 1) {
        console.log(`  ✓ PASS: ${validManifests[i][0]} - Failed as expected`);
        testsPassed++;
      } else {
        console.log(`  ✗ FAIL: ${validManifests[i][0]} - ${err.message}`);
        errors++;
        testsFailed++;
        errArr.push(["Valid Manifests", validManifests[i][0], err.message]);
      }
    }
  }

  /*
  TEST - Success Manifests (should complete successfully)
  */
  console.log("\n>>> Testing Success Manifests (test/src/manifests-success/)");
  var successManifests = [];
  const successDir = "test/src/manifests-success";
  const successFiles = fs.readdirSync(successDir).filter(f => f.endsWith('.yml'));
  
  successFiles.forEach(file => {
    successManifests.push([`${successDir}/${file}`, false, false, false, 0]);
  });

  for (var j = 0; j < successManifests.length; j++) {
    try {
      console.log(`  Testing: ${successManifests[j][0]}`);
      await init.merge.start(successManifests[j][0], successManifests[j][1], successManifests[j][2], successManifests[j][3]);
      var promise2 = new Promise(res => {
        setTimeout(() => res("Done"), 500);
      });
      await promise2;
      
      console.log(`  ✓ PASS: ${successManifests[j][0]}`);
      testsPassed++;
    } catch (err) {
      console.log(`  ✗ FAIL: ${successManifests[j][0]} - ${err.message}`);
      errors++;
      testsFailed++;
      errArr.push(["Success Manifests", successManifests[j][0], err.message]);
    }
  }

  /*
  TEST - Fail Safely Manifests (should fail gracefully)
  */
  console.log("\n>>> Testing Fail-Safely Manifests (test/src/manifests-failSafely/)");
  var failManifests = [];
  const failDir = "test/src/manifests-failSafely";
  const failFiles = fs.readdirSync(failDir).filter(f => f.endsWith('.yml'));
  
  failFiles.forEach(file => {
    failManifests.push([`${failDir}/${file}`, false, false, false, 1]);
  });

  for (var k = 0; k < failManifests.length; k++) {
    try {
      console.log(`  Testing: ${failManifests[k][0]}`);
      await init.merge.start(failManifests[k][0], failManifests[k][1], failManifests[k][2], failManifests[k][3]);
      var promise3 = new Promise(res => {
        setTimeout(() => res("Done"), 500);
      });
      await promise3;
      
      console.log(`  ✗ FAIL: ${failManifests[k][0]} - Expected to fail but succeeded`);
      errors++;
      testsFailed++;
      errArr.push(["Fail-Safely Manifests", failManifests[k][0], "Expected to fail but succeeded"]);
    } catch (err) {
      console.log(`  ✓ PASS: ${failManifests[k][0]} - Failed safely as expected`);
      testsPassed++;
    }
  }

  /*
  TEST - Asset Cleaning (Preview Mode)
  */
  console.log("\n>>> Testing Asset Cleaning (Preview Mode)");
  var assetCleanArr = [];
  assetCleanArr.push(
    ["test/src", "assets", false, 0],  // [directory, assetsFolderName, fixMode, expectError]
    ["test/src/m1", "assets", false, 0],
    ["test/src/m2", "assets", false, 0]
  );
  
  for (var m = 0; m < assetCleanArr.length; m++) {
    try {
      console.log(`  Testing: cleanAssets(${assetCleanArr[m][0]}, ${assetCleanArr[m][1]}, preview)`);
      const result = init.assetCleaner.cleanAssets(
        assetCleanArr[m][0],
        assetCleanArr[m][1],
        assetCleanArr[m][2],
        false  // verbose = false for testing
      );
      
      if (result.error) {
        if (assetCleanArr[m][3] === 0) {
          console.log(`  ✗ FAIL: ${assetCleanArr[m][0]} - ${result.error}`);
          errors++;
          testsFailed++;
          errArr.push(["Asset Cleaning Preview", assetCleanArr[m][0], result.error]);
        } else {
          console.log(`  ✓ PASS: ${assetCleanArr[m][0]} - Failed as expected`);
          testsPassed++;
        }
      } else {
        console.log(`  ✓ PASS: ${assetCleanArr[m][0]} (found ${result.totalUnusedAssets} unused assets)`);
        testsPassed++;
      }
    } catch (err) {
      if (assetCleanArr[m][3] === 0) {
        console.log(`  ✗ FAIL: ${assetCleanArr[m][0]} - ${err.message}`);
        errors++;
        testsFailed++;
        errArr.push(["Asset Cleaning Preview", assetCleanArr[m][0], err.message]);
      } else {
        console.log(`  ✓ PASS: ${assetCleanArr[m][0]} - Failed as expected`);
        testsPassed++;
      }
    }
  }

  /*
  TEST - Asset Cleaning (Fix Mode - with cleanup)
  Note: This test creates temporary files to test deletion without affecting real test assets
  The asset cleaner expects a module-based structure: targetDir/module/assets/
  */
  console.log("\n>>> Testing Asset Cleaning (Fix Mode)");
  
  // Create a temporary test directory with dummy assets in module structure
  const tempTestDir = path.join("test", "temp-asset-test");
  const tempModuleDir = path.join(tempTestDir, "test-module");
  const tempAssetsDir = path.join(tempModuleDir, "assets");
  
  try {
    // Setup temp directory with module structure
    if (!fs.existsSync(tempModuleDir)) {
      fs.mkdirSync(tempModuleDir, { recursive: true });
    }
    if (!fs.existsSync(tempAssetsDir)) {
      fs.mkdirSync(tempAssetsDir, { recursive: true });
    }
    
    // Create a markdown file that references one image
    const mdContent = `# Test Document
![Used Image](assets/used-image.png)
Some content here.`;
    fs.writeFileSync(path.join(tempModuleDir, "test.md"), mdContent);
    
    // Create two asset files: one used, one unused
    fs.writeFileSync(path.join(tempAssetsDir, "used-image.png"), "fake image content");
    fs.writeFileSync(path.join(tempAssetsDir, "unused-image.png"), "fake unused image");
    
    // Test preview mode first
    console.log(`  Testing: cleanAssets(${tempTestDir}, assets, preview)`);
    const previewResult = init.assetCleaner.cleanAssets(tempTestDir, "assets", false, false);
    
    if (previewResult.totalUnusedAssets === 1) {
      console.log(`  ✓ PASS: Preview found 1 unused asset (as expected)`);
      testsPassed++;
    } else {
      console.log(`  ✗ FAIL: Preview expected 1 unused, found ${previewResult.totalUnusedAssets}`);
      errors++;
      testsFailed++;
      errArr.push(["Asset Cleaning Preview", tempTestDir, `Expected 1 unused, found ${previewResult.totalUnusedAssets}`]);
    }
    
    // Test fix mode (actually delete)
    console.log(`  Testing: cleanAssets(${tempTestDir}, assets, fix)`);
    const fixResult = init.assetCleaner.cleanAssets(tempTestDir, "assets", true, false);
    
    if (fixResult.totalUnusedAssets === 1) {
      console.log(`  ✓ PASS: Fix mode deleted 1 unused asset`);
      testsPassed++;
      
      // Verify file was actually deleted
      if (!fs.existsSync(path.join(tempAssetsDir, "unused-image.png"))) {
        console.log(`  ✓ PASS: Unused file was actually deleted`);
        testsPassed++;
      } else {
        console.log(`  ✗ FAIL: Unused file still exists after deletion`);
        errors++;
        testsFailed++;
        errArr.push(["Asset Cleaning Fix", tempTestDir, "File not deleted"]);
      }
      
      // Verify used file still exists
      if (fs.existsSync(path.join(tempAssetsDir, "used-image.png"))) {
        console.log(`  ✓ PASS: Used file was preserved`);
        testsPassed++;
      } else {
        console.log(`  ✗ FAIL: Used file was incorrectly deleted`);
        errors++;
        testsFailed++;
        errArr.push(["Asset Cleaning Fix", tempTestDir, "Used file deleted"]);
      }
    } else {
      console.log(`  ✗ FAIL: Fix mode expected to delete 1, deleted ${fixResult.totalUnusedAssets}`);
      errors++;
      testsFailed++;
      errArr.push(["Asset Cleaning Fix", tempTestDir, `Expected 1 deleted, got ${fixResult.totalUnusedAssets}`]);
    }
    
  } catch (err) {
    console.log(`  ✗ FAIL: Asset cleaning fix mode test - ${err.message}`);
    errors++;
    testsFailed++;
    errArr.push(["Asset Cleaning Fix", tempTestDir, err.message]);
  } finally {
    // Cleanup temp directory
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true });
    }
  }

  /*
  TEST - Manifest Creation
  */
  console.log("\n>>> Testing Manifest Creation");
  var createArr = [];
  createArr.push(
    ["test/src", 0],
    ["test/yaml-test", 0]
  );
  
  for (var l = 0; l < createArr.length; l++) {
    try {
      console.log(`  Testing: createManifestFile(${createArr[l][0]})`);
      init.manifestUtil.createManifestFile(createArr[l][0]);
      console.log(`  ✓ PASS: Created manifest in ${createArr[l][0]}`);
      testsPassed++;
    } catch (err) {
      if (createArr[l][1] === 0) {
        console.log(`  ✗ FAIL: ${createArr[l][0]} - ${err.message}`);
        errors++;
        testsFailed++;
        errArr.push(["Manifest Creation", createArr[l][0], err.message]);
      } else {
        console.log(`  ✓ PASS: ${createArr[l][0]} - Failed as expected`);
        testsPassed++;
      }
    }
  }

  // Clean up created manifest file
  fs.unlink("./manifest.yml", (err) => {
    if (err && err.code !== 'ENOENT') console.error("Error deleting manifest.yml:", err);
  });

  // Print summary
  console.log("\n========================================");
  console.log("Test Summary");
  console.log("========================================");
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Errors: ${errors}`);
  console.log("========================================\n");

  if (errArr.length > 0) {
    console.error("Failed Tests:");
    for (var m = 0; m < errArr.length; m++) {
      console.error(`  [${errArr[m][0]}] ${errArr[m][1]}`);
      console.error(`    └─ ${errArr[m][2]}`);
    }
    console.log("");
  }

  // Clean up test output folders
  deleteFoldersAndFiles("test/");
  
  // Exit with error code if tests failed
  if (errors > 0) {
    process.exit(1);
  }
}

function deleteFoldersAndFiles(directoryPath) {
  const foldersToDelete = ["merged", "target"];
  const filesToDelete = [];

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