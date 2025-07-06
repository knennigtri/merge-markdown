#!/usr/bin/env node

// Load environment variables from .env file
require("dotenv").config();

// Default to production unless NODE_ENV is explicitly set to dev
const isProduction = process.env.NODE_ENV !== "dev";

// Get the directory where this script is located
const scriptDir = __dirname;

// Conditionally require the appropriate module using absolute paths
const cliModule = isProduction 
  ? require(`${scriptDir}/../dist/cli.js`) 
  : require(`${scriptDir}/../src/cli.js`);

cliModule.run();