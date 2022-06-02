# merge-markdown [![Publish to NPM](https://github.com/knennigtri/merge-markdown/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/knennigtri/merge-markdown/actions/workflows/npm-publish.yml) [![Publish to GHP](https://github.com/knennigtri/merge-markdown/actions/workflows/ghp-publish.yml/badge.svg)](https://github.com/knennigtri/merge-markdown/actions/workflows/ghp-publish.yml)
Takes in a list of markdown files and merges them together
Available on NPM: https://www.npmjs.com/package/merge-markdown

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
# Contents

- [merge-markdown ![Publish to NPM](https://github.com/knennigtri/merge-markdown/actions/workflows/npm-publish.yml)](#merge-markdown-)
- [Contents](#contents)
  - [Installation](#installation)
  - [Command Line Tool](#command-line-tool)
  - [Usage](#usage)
  - [Manifest file format](#manifest-file-format)
    - [Supported {options}](#supported-options)
    - [QA Mode](#qa-mode)
    - [Examples](#examples)
      - [YAML used as input](#yaml-used-as-input)
      - [JSON used as input](#json-used-as-input)
      - [file specific options](#file-specific-options)
      - [QA mode being used](#qa-mode-being-used)
      - [Replace keys within a single file](#replace-keys-within-a-single-file)
      - [Options applied to all files](#options-applied-to-all-files)
      - [Options applied to all files in a folder](#options-applied-to-all-files-in-a-folder)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation
To install the command line tool globally, run:

```shell
npm install -g merge-markdown
```

## Command Line Tool

The command line tool optionally takes 1 argument, the file name or http/https URL.
If not supplied, the tool reads from standard input.

uses default `./manifest.[md|yaml|yml|json]` for input
```shell
merge-markdown
```
Merges based on manifest file
```shell
merge-markdown -m myManifest.md
```
Merges based on `path/to/files` default manifest or merges all files in a default order
```shell
merge-markdown -m path/to/files
```
With QA
```shell
merge-markdown -m myManifest.md --qa
```

## Usage
```shell
Usage: merge-markdown [OPTIONS]
Options:
  -m manifestPath           Path to input folder, yaml, or json manifest
  --qa                      QA mode.
  --version                 Displays version of this package
  -v                        Verbose output
  -d                        Debug output
  -h                        Displays this screen
  -h [manifest|options|qa]  See examples
Default manifest: manifest.[md|yaml|yml|json] unless specified in -m. 
```

## Manifest file format

`manifest.[md|yaml|yml|json]`:
This file can be in YAML or JSON format. Relative or absolute paths can be used.

* `input`: markdown files to be merged. These can be relative or absolute paths. If no `input` is given, all .md files in the same directory as the manifest will be merged.
  * `{options}`: Options that will be applied to an individual file
* `output`: path/name.md of the resultant file of the merge. If no  `output` is given, the merged file will be saved in `merged/<curDir>.out.md`.
* `{options}`: Options applied to all `input` files

### Supported {options}
* `noYAML`: optionlly removes YAML. Default=false
* `TOC`: optionally adds a TOC to this file with doctoc. Default=false. See https://www.npmjs.com/package/doctoc#specifying-location-of-toc 
* `replace`:
  * string: Specify a string to find and replace
  * regex: Specify a regex to find and replace
```yaml
---
  noYAML: true|false
  TOC: true|false|"TOC title"
  replace:
      <!--{timestamp}-->: 01/01/2021
      ({#(.*?)}): ""                  
---
```
### QA Mode
```shell
merge-markdown -m manifest.json --qa
```
Output will omit all filenames with `frontmatter` by default
Add a regex to the manifest.json to customize exclusion:
```yaml
---
  qa: {exclude: "(frontmatter|preamble)"}
---
```

### Examples

#### YAML used as input
```yaml
---
input:
  frontmatter.md: ""
  file1.md: {noYAML: true, TOC: "#### Section Contents"}
  file2.md: {noYAML: true, TOC: "#### Section Contents"}
output: myOutput.md
---
```
#### JSON used as input
```json
{
  "input": {
    "frontmatter.md": {"replace": {"timestamp":true}},
    "file1.md": {"noYAML":true,"TOC":"#### Section Contents"},
    "file2.md": {"noYAML":true,"TOC":"#### Section Contents"}
  },
  "output": "myOutput.md"
}
```
#### file specific options
```json
{
  "input": {
    "folder1/file1.md": {"TOC":true},
    "folder2/file2.md": {"noYAML":true,"TOC":true}
  },
  "output": "output/myOutput.md"
}
```
#### QA mode being used
Excluding files with `frontmatter` or `file1` in the file name
```json
{
  "input": {
    "global-frontmatter.md": "",
    "module1Folder/file1.md": "",
    "module2Folder/file2.md": {"noYAML":true,"TOC":true}
  },
  "output": "output/myOutput.md",
  "qa": {
    "exclude": "(frontmatter|file1)"
  }
}
```
#### Replace keys within a single file
```json
{
  "input": {
    "folder1/folder1/file1.md": {"replace": {
      "<!--{timestamp}-->": "06/01/2021",
      "<!--{endOfSection}-->": "> To learn more on this subject, visit: www.example.com",
      "({#(.*?)})": ""
      }},
    "folder2/folder2/file2.md": {"noYAML":true}
  },
  "output": "output/1/myOutput.md",
}
```
#### Options applied to all files
```yaml
---
input:
  frontmatter.md: ""
  folder1/file1.md: ""
  file2.md: ""
output: myOutput.md
replace:
  ${timestamp}: 06/01/2021
  ({#(.*?)}): ""
TOC: "#### Chapter contents"
noYAML: true
---
```
#### Options applied to all files in a folder
```yaml
---
output: myOutput.md
noYAML: true
replace:
  ${timestamp}: 06/01/2021
  ({#(.*?)}): ""
TOC: "#### Chapter contents"
---
```