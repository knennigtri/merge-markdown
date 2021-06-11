# merge-markdown [![Publish to NPM](https://github.com/knennigtri/merge-markdown/actions/workflows/npm-publish.yml/badge.svg?branch=main)](https://github.com/knennigtri/merge-markdown/actions/workflows/npm-publish.yml)
Takes in a list of markdown files and merges them together
Available on NPM: https://www.npmjs.com/package/merge-markdown

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
# Contents

- [Installation](#installation)
- [Command Line Tool](#command-line-tool)
  - [Examples](#examples)
- [Usage](#usage)
- [Manifest file format](#manifest-file-format)
  - [Supported {options}](#supported-options)
  - [Examples](#examples-1)
    - [Custom TOC title in a file.](#custom-toc-title-in-a-file)
    - [Module specific options](#module-specific-options)
    - [QA mode being used](#qa-mode-being-used)
    - [Replace keys with default replace pattern](#replace-keys-with-default-replace-pattern)
    - [Global options and replace with a unique pattern](#global-options-and-replace-with-a-unique-pattern)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation
To install the command line tool globally, run:

```shell
npm install -g merge-markdown
```

## Command Line Tool

The command line tool optionally takes 1 argument, the file name or http/https URL.
If not supplied, the tool reads from standard input.

merges all files at the root
```shell
merge-markdown
```
Merges based on manifest file
```shell
merge-markdown -m manifest.json
```
Merges all md files in the folder
```shell
merge-markdown -m path/to/files
```

With QA
```shell
merge-markdown -m myManifest.json --qa
```

## Usage

```shell
Usage: merge-markdown [OPTIONS]
Options:
  -m manifestName      [json | folder]
  --qa                 QA mode.
  -v                   Verbose output
  -d                   Debug output
  --h                  Displays this screen
  --hme                Displays manifest example
  --hopts              Displays manifest options help
  --hqa                Displays qa help
  --version            Displays version of this package
Default manifest: manifest.json unless specified in -m. 
If there is no manifest, all md files in the folder will be used.
```

## Manifest file format

`manifest.json`:
This file should be in project directory where markdown files are to be merged

* `input`: json object of markdown files within the local project. These can be relative paths.
  * `{options}`: Options that can be applied to individual files for merge preperation 
* `output`: path/name.md of the resultant file of the merge. The path should be the same level deep as the markdown files to maintain asset references.
* `{options}`: Options can also be applied to all files at a global level

### Supported {options}
* noYAML: optionlly removes YAML. Default=false
* TOC: optionally adds a TOC to this file with doctoc. Default=false. See https://www.npmjs.com/package/doctoc#specifying-location-of-toc 
* replace: searches for `<!--{key}-->` and replaces with `value`
  * startStr:    optional. Set a unqiue start str for replace. Default is `<!--{`
  * endStr:      optional. Set a unqiue start str for replace. Default is `}-->`
  * timestamp:   true for todays date or add you own timestamp string
  * *:           replace any key string with the value string
```
{
  "noYAML": true|false
  "TOC": true|false|"TOC title"
  "replace": {
      "timestamp": true|false|"stringVal"
      *: "stringVal"                  
}
```

### Examples

#### Custom TOC title in a file.
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
#### Module specific options
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
* Excluding files with `frontmatter` or `file1` in the file name
```json
{
  "input": {
    "global-frontmatter.md": "",
    "module1Folder/file1.md": "",
    "module2Folder/file2.md": {"noYAML":true,"TOC":true}
  },
  "output": "output/myOutput.md",
  "qa": {
    "exclude": "frontmatter|file1"
  }
}
```
#### Replace keys with default replace pattern 
* `<!--{timestamp}-->` is replaced with `06/01/2021`
* `<!--{courseName}-->` is replaced with `My amazing course`
* `<!--{endOfSection}-->` is replaced with `> To learn more on this subject, visit: www.example.com`
```json
{
  "input": {
    "folder1/folder1/file1.md": {"replace": {
      "timestamp":"06/01/2021",
      "courseName":"My amazing course",
      "endOfSection":"> To learn more on this subject, visit: www.example.com"
      }},
    "folder2/folder2/file2.md": {"noYAML":true}
  },
  "output": "output/1/myOutput.md",
}
```
#### Global options and replace with a unique pattern
* `${timestamp}` will replace `06/01/2021`
```json
{
  "input": {
    "folder1/file1.md": "",
    "folder2/file2.md": {"noYAML":true}
  },
  "output": "output/myOutput.md",
  "replace":{
    "startStr":"${",
    "endStr":"}",
    "timestamp":"06/01/2021",
	},
  "TOC": "#### Chapter contents"
}
```
