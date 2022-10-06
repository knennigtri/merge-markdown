# merge-markdown
[![Build & Publish to NPM and GHP](https://github.com/knennigtri/merge-markdown/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/knennigtri/merge-markdown/actions/workflows/release.yml)

# Overview
Takes in a list of markdown files and merges them into a single output file with optional HTML and PDF output. Other advantages:
* Merge all md files in a folder
* auto-resolution of all relative links in files for assets, other markdown files no matter their location locally
* built in link checker of final file
* Use a Manifest file (json/yaml):
  * Specify the input list of files (relative or absolute)
  * Specify the output file (relative or absolute)
    * Add pandoc arguments for HTML output
    * Add wkhtmltopdf for PDF output
    * Create a TOC with doctoc
  * QA feature for optional file exclusions for reviewing
  * Per input file or globally:
    * Find/replace with regex (ex: names, titles, chapter #s, timestamps, etc)
    * Create TOC with doctoc
    * Remove yaml from top of md file

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
# Contents

- [merge-markdown](#merge-markdown)
- [Overview](#overview)
- [Contents](#contents)
  - [Installation](#installation)
  - [Command Line Tool](#command-line-tool)
  - [Usage](#usage)
  - [Manifest file format](#manifest-file-format)
    - [Supported Options](#supported-options)
      - [noYAML](#noyaml)
      - [replace](#replace)
      - [doctoc](#doctoc)
    - [Supported Output Options](#supported-output-options)
      - [Merged file TOC](#merged-file-toc)
      - [HTML Output](#html-output)
      - [PDF Output](#pdf-output)
    - [Special Modes](#special-modes)
      - [QA Mode](#qa-mode)
      - [nolinkcheck Mode](#nolinkcheck-mode)
      - [Debug Mode](#debug-mode)
  - [Manifest Examples](#manifest-examples)
    - [YAML used as input](#yaml-used-as-input)
    - [JSON used as input](#json-used-as-input)
    - [Replace keys within a single file](#replace-keys-within-a-single-file)
    - [Options applied to all files](#options-applied-to-all-files)
    - [Apply output options](#apply-output-options)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation
To install the command line tool globally, run:

```shell
npm install -g @knennigtri/merge-markdown
```

## Command Line Tool

Use default `./manifest.[md|yaml|yml|json]` for input
```shell
> merge-markdown
```
Merge based on manifest file
```shell
> merge-markdown -m myManifest.md
```
Merge based on `path/to/files` default manifest or merges all files in a default order
```shell
> merge-markdown -m path/to/files
```
Output to PDF
```shell
> merge-markdown -m myManifest.md --pdf
```

## Usage
```shell
Usage: merge-markdown [ARGS]
Arguments:
  -m <manifestFile>                        Path to input folder, yaml, or json manifest
  -v, --version                            Displays version of this package
      --qa                                 QA mode.
      --nolinkcheck                        Skips linkchecking
      --pdf                                Output to PDF. wkhtmltopdf must be installed http://wkhtmltopdf.org/downloads.html
      --html                               Output to HTML
  -h, --help                               Displays this screen
  -h [manifest|options|outputOptions|qa]   See examples
Default manifest: manifest.[md|yaml|yml|json] unless specified in -m. 
```

## Manifest file format

`manifest.[md|yaml|yml|json]`:
This file can be in YAML or JSON format.

* `input`: No `input` will merge all .md files in the same directory as the manifest.
  * `myFile1.md: {options}` *Local options*
  * `myFile2.md: {options}`
* `output`: No  `output` will be save the merged doc in in `merged/<curDir>.out.md`.
  * `name: path/name.md`: of the resultant file
  * `{outputOptions}` See [Supported Output Options](#supported-output-options)
* `{options}`: global options. See [Supported Options](#supported-options)

> Relative or absolute paths can be used for all values

### Supported Options
Options can be applied to an individual input or at a globally to apply to all inputs

#### noYAML

Optionlly removes YAML from top of input file. Default=false
```yaml
---
  noYAML: true|false
---
```

#### replace

Optionally find/replace in an input file.
  * string: Specify a string to find and replace
  * regex: Specify a regex to find and replace
```yaml
---
  replace:
      <!--{timestamp}-->: 09/01/2022
      ({#(.*?)}): ""                  
---
```

#### doctoc
Optionally add a table of contents to files using [doctoc](https://www.npmjs.com/package/doctoc). This will allow for a local navigation within a module/chapter of your merged document.

```yaml
# Use Default doctoc values:
---
 doctoc: true
---
# Add a unique title:
---
 doctoc: "Module Contents"
---
# Fully configure doctoc by overriding the default values from below:
---
  doctoc:
   mode: github
   maxlevel: 3
   title: ""
   notitle: true
   entryprefix: ""
   all: false
   stdout: true
   update-only: false                
---
```
Based on [doctoc](https://www.npmjs.com/package/doctoc#specifying-location-of-toc), Set where you would like for the TOC to exist in the markdown file
```html
  <!-- START auto-update -->
  <!-- START doctoc -->
  <!-- END doctoc -->
  <!-- END auto-update -->
```


### Supported Output Options
You can output to HTML or PDF. Pandoc is used to generate HTML and wkhtmltopdf is used to generate a PDF.

#### Merged file TOC
Similar to adding a TOC to the input files, you can add a TOC for the entire merged document. See [doctoc](#doctoc) options to configure.
```yaml
 output:
   doctoc:
     key: value
```


#### HTML Output
You can optionally add pandoc parameters to the manifest. The `key` doesn't matter, only the `value` is evalutated based on [pandoc args](https://pandoc.org/MANUAL.html).
```yaml
 output:
   pandoc:
     latexTemplate: --template path/to/my/latex/template.latex
     css: -c path/to/my/css/main.css
```
> The following arguments cannot be changes for pandoc:
>  * `-o < fileName >`  - can only be modified using manifest.output.name

#### PDF Output


You can optionally add wkhtmltopdf options to the manifest. [wkhtmltopdf](http://wkhtmltopdf.org/downloads.html) must be installed and added to your path to create PDFs!

See [wkhtmltopdf options](https://www.npmjs.com/package/wkhtmltopdf#options) to learn more:
```yaml
 output:
   wkhtmltopdf:
    marginBottom: 1in
    marginTop: 1in
    pageSize: Letter
```
> The following options cannot be changes for wkhtmltopdf:
>  * `enableLocalFileAccess` - always true
>  * `disableSmartShrinking` - always true
>  * `output` - can only be modified using manifest.output.name

Generate HTML only:
```shell
 merge-markdown -m manifest.md --html
```
Generate a PDF:
```shell
 merge-markdown -m manifest.md --pdf
```
Example files can be found in [test/pdf/src](test/pdf/src). You can also checkout a [working project](https://github.com/knennigtri/example-webpack-project) for css development using webpack.

### Special Modes

#### QA Mode
```shell
> merge-markdown -m manifest.json --qa
```
Output will omit all filenames with `frontmatter` by default
Add a regex to the manifest.json to customize exclusion:
```yaml
---
  qa: {exclude: "(frontmatter|preamble)"}
---
```

#### nolinkcheck Mode
Sometimes the [markdown-link-check](https://www.npmjs.com/package/markdown-link-check) tool might produce an error. To skip linkcheck:
```shell
> merge-markdown -m mymanifest.yml --nolinkcheck
```

#### Debug Mode
[Debug](https://www.npmjs.com/package/debug) is used in this tool. Available debug options:
 * index:[ input | manifest ]
 * index:manifest:[ json | generate ]
 * merge:[ relinks | yaml | doctoc | replace | linkcheck ]
 * presentation:[ html | pdf ]:options
 * presentation:verbose

## Manifest Examples

### YAML used as input
```yaml
---
input:
  frontmatter.md: ""
  file1.md: {noYAML: true, doctoc: "#### Section Contents"}
  file2.md: {noYAML: true, doctoc: "#### Section Contents"}
output: 
  name: myOutput.md
---
```
### JSON used as input
```json
{
  "input": {
    "frontmatter.md": {"replace": {"timestamp":true}},
    "file1.md": {"noYAML":true,"doctoc":"#### Section Contents"},
    "file2.md": {"noYAML":true,"doctoc":"#### Section Contents"}
  },
  "output": {
    "name": "myOutput.md"
  }
}
```
### Replace keys within a single file
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
  "output": {
    "name": "path/to/myOutput.md"
  }
}
```
### Options applied to all files
```yaml
---
input:
  frontmatter.md: ""
  folder1/file1.md: ""
  file2.md: ""
output: 
  name: myOutput.md
replace:
  ${timestamp}: 06/01/2021
  ({#(.*?)}): ""
doctoc: "#### Chapter contents"
noYAML: true
---
```
### Apply output options
``` yaml
---
input:
 frontmatter.md: ''
 m1/m1-example.md: {noYAML: true, doctoc: true, replace: {<!--#-->: "Module 1:"}}
 m2/m2-example.md: {noYAML: true, doctoc: true, replace: {<!--#-->: "Module 2:"}}
output: 
  name: merged/myOutput.md
  doctoc:
   mode: bitbucket
   title: "Course Contents"
   maxlevel: 2
  pandoc:
    css: -c path/to/main.css
    title: -M title:Example
  wkhtmltopdf:
    pageSize: Letter
    footerLine: true
    footerCenter: Page [page]
---
```