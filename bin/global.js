#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

// Default to production unless NODE_ENV is explicitly set to dev
const isProduction = process.env.NODE_ENV !== "dev";

// Conditionally require the appropriate module
const cliModule = isProduction ? require("../dist/cli.js") : require("../src/cli.js");

cliModule.run();