# merge-markdown

[![Build & Publish to NPM and GHP](https://github.com/knennigtri/merge-markdown/actions/workflows/release.yml/badge.svg?branch=dev)](https://github.com/knennigtri/merge-markdown/actions/workflows/release.yml)

# Overview

Takes in a list of markdown files and merges them into a single output.md file with optional Word, HTML, or PDF output. Other advantages:

* Auto-create a manifest.yml (based on the directory), sample theme folder, and package.json
* Run in docker to reduce dependencies and discrepancies
* auto-resolution of all relative links in files for assets, other markdown files no matter their location locally
* built in link checker of final file
* Use the Manifest file (json/yaml):
  * Specify the input list of files (relative or absolute)
  * Specify the output file (relative or absolute)
    * Add pandoc arguments for Word/HTML output
    * Add wkhtmltopdf arguments for PDF output
    * Create a TOC with doctoc
  * QA feature for optional file exclusions for reviewing
  * Per input file or globally:
    * Find/replace with regex (ex: names, titles, chapter #s, timestamps, etc)
    * Create TOC with doctoc
    * Remove yaml from top of md file

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
# Contents

- [Installation](#installation)
- [Basic Use](#basic-use)
- [Usage](#usage)
- [Manifest file format](#manifest-file-format)
  - [Supported Options](#supported-options)
  - [Supported Output Options](#supported-output-options)
  - [Special Modes](#special-modes)
- [Manifest Examples](#manifest-examples)
  - [YAML used as input](#yaml-used-as-input)
  - [JSON used as input](#json-used-as-input)
  - [Replace keys within a single file](#replace-keys-within-a-single-file)
  - [Options applied to all files](#options-applied-to-all-files)
  - [Apply output options](#apply-output-options)
- [Using Docker](#using-docker)
  - [Full CLI](#full-cli)
  - [Configurable Build](#configurable-build)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

To install the command line tool globally, run:

```shell
  npm install -g @knennigtri/merge-markdown
  #See full list of commands
  merge-markdown -h
```

## Basic Use

Create a new merge-markdown project with existing markdown files:

```shell
  # Create an initial manifest with markdown files in a directory
  > merge-markdown -c my/path/src

  # Create a full npm project with a theme folder
  > merge-markdown -c my/path/src --fullProject
```

Run merge-markdown

```shell
  # Merge based on existing manifest file, outputs markdown file
  > merge-markdown -m manifest.yml

  # Output to Word
  > merge-markdown -m myManifest.yml --word

  # Output to html
  > merge-markdown -m myManifest.yml --html
  
  # Output to PDF
  > merge-markdown -m myManifest.yml --pdf
  
  # Requires docker to be installed
  > merge-markdown -m myManifest.yml --pdf --docker

```

> Using Docker is preferred. Using `--docker` simplifies external installation requirements like pandoc and wkhtmltopdf.

## Usage

```
Usage: merge-markdown [ARGS]
Arguments:
  -m, --manifest <manifestFile>            Path to input folder, yaml, or json manifest
  -v, --version                            Displays version of this package
  -c, --create <path>                      auto-creates ./manifest.yml with input files from <path>
  --fullProject                            Add to -c to include a basic theme, frontmatter, and npm scripts
  --docker                                 Run merge-markdown commands in docker
  --getDockerFiles                         Downloads the Docker files to your local project
  --qa                                     QA mode.
  --skipLinkcheck                          Skips linkchecking
  --maintainAssetPaths                     Retains original asset paths
  --pdf                                    Output to PDF. Must have Pandoc and wkhtmltopdf installed!
  --html --word                            Output to HTML or Word. Must have Pandoc installed!
  -h, --help                               Displays this screen
  -h manifest | options |
    outputOptions | qa | docker            See examples
  -d, --debug                              See debug Options
Default is manifest[.yml|.yaml|.json] unless specified in -m.

Download Docker: https://docs.docker.com/get-docker/
```

## Manifest file format

`manifest[.yml|.yaml|.json]`:
This file can be in YAML or JSON format.

* `input`: 
  * `myFile1.md: {options}` *Local options*
  * `myFile2.md: {options}`
* `output`:
  * `name: path/name.md`: of the resultant file
  * `{outputOptions}` See [Supported Output Options](#supported-output-options)
* `{options}`: *global options*

See [Supported Options](#supported-options)
Relative or absolute are accepted


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

#### HTML and Word Output

You can optionally add pandoc parameters to the manifest. The `key` doesn't matter, only the `value` is evalutated based on [pandoc args](https://pandoc.org/MANUAL.html).

> If you aren't using Docker, [pandoc](https://pandoc.org/installing.html) must be installed!

```yaml
  # HTML parameters
  output:
    pandoc:
      latexTemplate: --template path/to/my/latex/template.latex
      css: -c path/to/my/css/main.css
```

```yaml
  # Word parameters
  output:
    pandoc:
      referenceDoc: '--reference-doc theme/reference.docx'
```

Generate HTML/Word only:

```shell
  #HTML
  > merge-markdown -m manifest.yml --html
  # Word
  > merge-markdown -m manifest.yml --word
```

> The following arguments cannot be changes for pandoc:
>
> * `-o < fileName >`  - can only be modified using manifest.output.name

#### PDF Output

You can optionally add [wkhtmltopdf options](https://www.npmjs.com/package/wkhtmltopdf#options) to the manifest.

> If you aren't using Docker, [pandoc](https://pandoc.org/installing.html) and [wkhtmltopdf](http://wkhtmltopdf.org/downloads.html) must be installed!

```yaml
  output:
    # html parameters are still needed since conversion is markdown > html > PDF
    pandoc:
      latexTemplate: --template path/to/my/latex/template.latex
      css: -c path/to/my/css/main.css
    wkhtmltopdf:
      marginBottom: 1in
      marginTop: 1in
      pageSize: Letter
```

> The following options cannot be changes for wkhtmltopdf:
>
> * `enableLocalFileAccess` - always true
> * `disableSmartShrinking` - always true
> * `output` - can only be modified using manifest.output.name

Generate a PDF:

```shell
 > merge-markdown -m manifest.yml --pdf
```

Example files can be found in [test/pdf/src](test/pdf/src). You can also checkout a [working project](https://github.com/knennigtri/example-webpack-project) for css development using webpack.


### Special Modes

#### QA Mode

```shell
  > merge-markdown -m manifest.yml --qa
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

[Debug](https://www.npmjs.com/package/debug) is used in this tool:

Mac or Linux:
```shell
 > DEBUG:options merge-markdown -m file
 ```

Windows:
```shell
> set DEBUG=options & merge-markdown -m file
```

```
Options: {
  "*": "Output all debugging messages",
  "args": "See CLI argument messages",
  "cli": "Validate CLI logic",
  "manifest": "",
  "manifest:deprecation": "",
  "manifest:json": "",
  "merge": "messages for merge process",
  "rellinks": "relative links",
  "o:yaml": "yaml removal",
  "o:doctoc": "doctoc messages",
  "o:replace": "regex replace messages",
  "linkcheck": "linkcheck validation",
  "linkcheck:deep": "deep linkcheck validation",
  "presentation": "",
  "html": "pandoc messages for html",
  "html:options": "pandoc options messages",
  "pdf": "wkhtmltopdf messages for pdf",
  "pdf:options": "wkhtmltopdf options messages",
  "docker": ""
}
```

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

## Using Docker
To use docker, make sure you have docker [downloaded](https://docs.docker.com/get-docker/) and started. Using docker sidesteps the requirements of installing pandoc and wkhtmltopdf locally and makes this tool more agnostic.

1. [Full CLI](#full-cli)
2. [Configurable Build](#configurable-build)

### Full CLI

1. Run the docker application
2. Run your merge-markdown command with the `--docker` parameter

```shell
 merge-markdown -m path/to/manifest.yml --pdf --docker
```

#### Exclude certain files from copying into Docker
For speed purposes, you can optionally exclude certain files and folders from copying into docker. By default, these folders are not copied:
  ```
  const EXCLUDE_PATHS = [
    /.*\/node_modules\/.*/,
    /.*\/merged\/.*/,
    /.*\/target\/.*/,
  ];
  ```
To add more paths, update the manifest file:
```
docker:
  excludePaths: ["my/excluded/path", "temp.txt"]
```

### Configurable Build

Download the `Dockerfile` and `docker-compose.yml` files:
```shell
 merge-markdown --getDockerFiles
```

`Dockerfile` and `docker-compose.yml` files need to be in the same directory as your project and set
up Docker Compose with the following command:

```shell
 docker compose up -d --build
```

The docker image will copy all local structure of files and directories of the project into the current
image's working directory. Once there, the command `merge-markdown` needs to be executed on the `node` service of docker compose to generate the desired output, e.g:

```shell
docker compose exec node merge-markdown -m manifest.yml --pdf
```

The command above assumes the `manifest.yml` file is in the root directory. An example
of the project file structure could be:

```none
project
└── assets
    ├── image1.svg
    └── ...
├── docker-compose.yml
├── Dockerfile
├── manifest.yml
├── README.md
├── README_2.md
├── README_3.md
└── README_4.md
```

Getting the outputs from the container's image could be done with the following command:

```shell
 docker compose cp node:/home/runner/workspace/output.pdf .
```
