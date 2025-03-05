#!/usr/bin/env node

// Check if the environment is production
const isProduction = process.env.NODE_ENV === 'production';

// Conditionally require the appropriate module
const module = isProduction ? require("../dist/cli.js") : require("../src/cli.js");

module.run();