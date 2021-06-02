#!/usr/bin/env node

const fs = require('fs');

const configs = {
  semi: true,
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
};

fs.writeFile(
  `${process.cwd()}/.prettierrc`,
  JSON.stringify(configs),
  (error, data) => {
    if (error) {
      console.error('Error creating the configuration file.', error);
    }
    console.log('Configuration created');
  }
);