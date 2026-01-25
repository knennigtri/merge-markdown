const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const debug = require("debug")("asset-cleaner");

// Asset detection regex - same as used in merge.js updateAssetRelPaths function
const ASSET_REGEX = /(!\[(.*?)\][(](.*?)[)])|(src=[""](.*?)[""])/g;

/**
 * Checks if an asset is referenced in markdown content using the same logic as merge.js
 * @param {string} content - Markdown content to search
 * @param {string} assetFile - Asset filename to look for
 * @param {string} assetsFolderName - Name of the assets folder
 * @returns {boolean} True if asset is referenced
 */
function isAssetReferenced(content, assetFile, assetsFolderName) {
  // Reset regex for each search
  const regex = new RegExp(ASSET_REGEX.source, ASSET_REGEX.flags);
  
  const lines = content.split("\n");
  
  for (const line of lines) {
    let match;
    while ((match = regex.exec(line)) !== null) {
      let assetPath = "";
      
      // Extract asset path from match - same logic as merge.js
      if (match[0].startsWith("![")) {
        // Markdown image: ![alt](path)
        assetPath = match[3];
      } else if (match[0].startsWith("src=")) {
        // HTML img: src="path"
        assetPath = match[5];
      }
      
      if (assetPath) {
        // Check if this path references our asset file
        const fileName = path.basename(assetPath);
        if (fileName === assetFile) {
          return true;
        }
        
        // Also check for folder/file pattern
        if (assetPath.includes(`${assetsFolderName}/${assetFile}`)) {
          return true;
        }
      }
    }
    
    // Reset regex for next line
    regex.lastIndex = 0;
  }
  
  return false;
}

/**
 * Extracts the 'copy-images-to' value from YAML frontmatter in a markdown file
 * @param {string} mdFilePath - Path to the markdown file
 * @returns {string|null} The copy-images-to value or null if not found
 */
function extractAssetsDirFromFrontmatter(mdFilePath) {
  try {
    const content = fs.readFileSync(mdFilePath, "utf8");
    
    // Check if file starts with YAML frontmatter (---)
    if (!content.startsWith("---")) {
      return null;
    }
    
    // Extract the frontmatter between the first two ---
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return null;
    }
    
    // Parse the YAML
    const frontmatter = yaml.load(frontmatterMatch[1]);
    
    // Return the copy-images-to value if it exists
    return frontmatter && frontmatter["copy-images-to"] ? frontmatter["copy-images-to"] : null;
  } catch (error) {
    debug(`Error reading frontmatter from ${mdFilePath}: ${error.message}`);
    return null;
  }
}

/**
 * Scans for unused assets in a specific module/directory
 * @param {Array} mdFiles - Array of markdown file paths
 * @param {string} assetsDir - Path to assets directory
 * @param {string} moduleName - Name of the module (for logging)
 * @param {string} assetsFolderName - Name of the assets folder
 * @param {boolean} usingFrontmatter - Whether assets dir came from frontmatter
 * @param {boolean} fixMode - Whether to actually delete files
 * @param {boolean} verbose - Whether to show detailed output
 * @returns {Object} Results object with counts and details
 */
function scanModuleAssets(mdFiles, assetsDir, moduleName, assetsFolderName, usingFrontmatter = false, fixMode = false, verbose = true) {
  const result = {
    moduleName,
    assetsDir,
    assetsFolderName,
    usingFrontmatter,
    totalAssets: 0,
    keptAssets: 0,
    deletedAssets: 0,
    deletedFiles: [],
    error: null
  };

  if (!fs.existsSync(assetsDir)) {
    result.error = `Assets directory not found: ${assetsDir}`;
    if (verbose) console.log(`⚠️  ${result.error}`);
    return result;
  }
  
  if (mdFiles.length === 0) {
    result.error = `No markdown files found in: ${moduleName}`;
    if (verbose) console.log(`⚠️  ${result.error}`);
    return result;
  }
  
  if (verbose) {
    console.log(`📂 Processing: ${moduleName}`);
    console.log(`   Found ${mdFiles.length} markdown file(s)`);
    if (usingFrontmatter) {
      console.log(`   Using assets folder from frontmatter: '${assetsFolderName}'`);
    }
  }
  
  // Read all markdown files
  let allMdContent = "";
  mdFiles.forEach(mdFile => {
    try {
      const content = fs.readFileSync(mdFile, "utf8");
      allMdContent += content + "\n";
    } catch (error) {
      debug(`Error reading ${mdFile}: ${error.message}`);
    }
  });
  
  // Get all image files
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp"];
  let assetFiles = [];
  
  try {
    assetFiles = fs.readdirSync(assetsDir)
      .filter(file => imageExtensions.includes(path.extname(file).toLowerCase()));
  } catch (error) {
    result.error = `Error reading assets directory: ${error.message}`;
    if (verbose) console.log(`⚠️  ${result.error}`);
    return result;
  }
  
  result.totalAssets = assetFiles.length;
  
  assetFiles.forEach(assetFile => {
    // Check if asset is referenced in any markdown file using the same regex as merge.js
    const isReferenced = isAssetReferenced(allMdContent, assetFile, assetsFolderName);
    
    if (isReferenced) {
      result.keptAssets++;
    } else {
      if (fixMode) {
        try {
          fs.unlinkSync(path.join(assetsDir, assetFile));
          result.deletedFiles.push(assetFile);
          if (verbose) console.log(`   ❌ Deleted: ${assetFile}`);
        } catch (error) {
          debug(`Error deleting ${assetFile}: ${error.message}`);
        }
      } else {
        result.deletedFiles.push(assetFile);
        if (verbose) console.log(`   🔍 Would delete: ${assetFile}`);
      }
      result.deletedAssets++;
    }
  });
  
  if (verbose) {
    console.log(`   ✅ Kept: ${result.keptAssets} assets`);
    console.log(`   ${fixMode ? "❌ Deleted" : "🔍 Would delete"}: ${result.deletedAssets} assets\n`);
  }
  
  return result;
}

/**
 * Main function to clean assets in a target directory
 * @param {string} targetDir - Directory containing subdirectories with markdown files and assets
 * @param {string} assetsFolderName - Default name of assets folder
 * @param {boolean} fixMode - Whether to actually delete files
 * @param {boolean} verbose - Whether to show detailed output
 * @returns {Object} Summary results
 */
function cleanAssets(targetDir, assetsFolderName = "assets", fixMode = false, verbose = true) {
  const summary = {
    targetDir,
    assetsFolderName,
    fixMode,
    totalModules: 0,
    processedModules: 0,
    totalUnusedAssets: 0,
    results: []
  };

  if (verbose) {
    console.log("==========================================");
    console.log("  Cleaning Unreferenced Assets");
    console.log("==========================================\n");
    
    if (!fixMode) {
      console.log("🔍 PREVIEW MODE - No files will be deleted (use --fix to delete)\n");
    } else {
      console.log("⚠️  FIX MODE - Unreferenced assets will be deleted\n");
    }
    
    console.log(`📁 Assets folder name (default): '${assetsFolderName}'`);
    console.log(`📁 Target directory: ${targetDir}\n`);
  }

  if (!fs.existsSync(targetDir)) {
    const error = `Target directory does not exist: ${targetDir}`;
    if (verbose) console.error(`❌ Error: ${error}`);
    summary.error = error;
    return summary;
  }

  let subdirs = [];
  try {
    subdirs = fs.readdirSync(targetDir)
      .filter(item => fs.statSync(path.join(targetDir, item)).isDirectory());
  } catch (error) {
    const errorMsg = `Error reading target directory: ${error.message}`;
    if (verbose) console.error(`❌ Error: ${errorMsg}`);
    summary.error = errorMsg;
    return summary;
  }

  if (subdirs.length === 0) {
    if (verbose) console.log("⚠️  No subdirectories found in target directory");
    return summary;
  }

  summary.totalModules = subdirs.length;

  subdirs.forEach(subdirName => {
    const subdirPath = path.join(targetDir, subdirName);
    
    // Find all markdown files in this subdirectory
    let mdFiles = [];
    try {
      const files = fs.readdirSync(subdirPath);
      mdFiles = files
        .filter(f => f.endsWith(".md"))
        .map(f => path.join(subdirPath, f));
    } catch (error) {
      if (verbose) console.log(`⚠️  Error reading directory: ${subdirPath}`);
      return;
    }
    
    // Determine assets folder name - check frontmatter first (takes precedence)
    let moduleAssetsFolderName = assetsFolderName;
    let usingFrontmatter = false;
    
    for (const mdFile of mdFiles) {
      const frontmatterAssetsDir = extractAssetsDirFromFrontmatter(mdFile);
      if (frontmatterAssetsDir) {
        moduleAssetsFolderName = frontmatterAssetsDir;
        usingFrontmatter = true;
        break; // Use the first one found
      }
    }
    
    const assetsDir = path.join(subdirPath, moduleAssetsFolderName);
    
    // Only process if assets directory exists
    if (fs.existsSync(assetsDir)) {
      const result = scanModuleAssets(mdFiles, assetsDir, subdirName, moduleAssetsFolderName, usingFrontmatter, fixMode, verbose);
      summary.results.push(result);
      summary.processedModules++;
      summary.totalUnusedAssets += result.deletedAssets;
    }
  });

  if (verbose) {
    console.log("==========================================");
    console.log("✨ Cleanup Complete!");
    console.log("==========================================\n");
    
    if (!fixMode) {
      console.log("ℹ️  This was a preview. Run with --fix to actually delete unreferenced files.");
    }
  }

  return summary;
}

/**
 * Quick scan for unused assets (for integration with merge workflow)
 * @param {Array} inputFiles - Array of input file paths from manifest
 * @param {string} assetsFolderName - Default assets folder name
 * @returns {Object} Quick scan results
 */
function scanForUnusedAssets(inputFiles, assetsFolderName = "assets") {
  debug("Starting quick asset scan for merge workflow");
  
  const result = {
    totalUnusedAssets: 0,
    scannedDirectories: 0,
    hasUnusedAssets: false
  };

  if (!inputFiles || inputFiles.length === 0) {
    debug("No input files provided for asset scan");
    return result;
  }

  // Get unique directories from input files
  const directories = [...new Set(inputFiles.map(file => path.dirname(file)))];
  
  directories.forEach(dir => {
    // Look for assets directory in each input file directory
    const assetsDir = path.join(dir, assetsFolderName);
    
    if (fs.existsSync(assetsDir)) {
      result.scannedDirectories++;
      
      // Find markdown files in this directory
      let mdFiles = [];
      try {
        const files = fs.readdirSync(dir);
        mdFiles = files
          .filter(f => f.endsWith(".md"))
          .map(f => path.join(dir, f));
      } catch (error) {
        debug(`Error reading directory ${dir}: ${error.message}`);
        return;
      }

      // Quick scan without verbose output
      const scanResult = scanModuleAssets(mdFiles, assetsDir, path.basename(dir), assetsFolderName, false, false, false);
      if (!scanResult.error) {
        result.totalUnusedAssets += scanResult.deletedAssets;
      }
    }
  });

  result.hasUnusedAssets = result.totalUnusedAssets > 0;
  debug(`Quick scan complete: ${result.totalUnusedAssets} unused assets found in ${result.scannedDirectories} directories`);
  
  return result;
}

module.exports = {
  cleanAssets,
  scanForUnusedAssets,
  scanModuleAssets,
  extractAssetsDirFromFrontmatter
};