# merge-markdown 
[![Publish to NPM](https://github.com/knennigtri/merge-markdown/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/knennigtri/merge-markdown/actions/workflows/npm-publish.yml) [![Publish to GHP](https://github.com/knennigtri/merge-markdown/actions/workflows/ghp-publish.yml/badge.svg)](https://github.com/knennigtri/merge-markdown/actions/workflows/ghp-publish.yml)

Takes in a list of markdown files and merges them into a single output file with optional HTML and PDF output. Other advantages:
* Merge all md files in a folder
* auto-resolution of all relative links in files for assets, other markdown files no matter their location locally
* built in link checker of final file
* Use a Manifest file (json/yaml) for:
  * Specify the input list of files (relative or absolute)
  * Specify the output file (relative or absolute)
  * QA feature for optional file exclusions for reviewing
  * Per input file or globally:
    * Find/replace with regex (ex: names, titles, chapter #s, timestamps, etc)
    * Create TOC with optional Title
    * Remove yaml from top of md file
* Optionally use custom css and template.latex for HTML and PDF output


Available on NPM: https://www.npmjs.com/package/@knennigtri/merge-markdown 

Available on GPR: https://github.com/knennigtri/merge-markdown/packages/1458049 

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
# Contents

- [Installation](#installation)
- [Command Line Tool](#command-line-tool)
- [Usage](#usage)
- [Manifest file format](#manifest-file-format)
  - [Supported {options}](#supported-options)
  - [Global only options](#global-only-options)
    - [QA Mode](#qa-mode)
    - [Merged file TOC](#merged-file-toc)
    - [Output to PDF or HTML](#output-to-pdf-or-html)
- [Manifest Examples](#manifest-examples)
  - [YAML used as input](#yaml-used-as-input)
  - [JSON used as input](#json-used-as-input)
  - [Replace keys within a single file](#replace-keys-within-a-single-file)
  - [Options applied to all files](#options-applied-to-all-files)
  - [Apply custom HTML and PDF options](#apply-custom-html-and-pdf-options)
  - [Other Examples in the manifest](#other-examples-in-the-manifest)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation
To install the command line tool globally, run:

```shell
npm install -g @knennigtri/merge-markdown
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
Output to PDF
```shell
merge-markdown -m myManifest.md --pdf
```

## Usage
```shell
Usage: merge-markdown [OPTIONS]
Options:
  -m manifestPath           Path to input folder, yaml, or json manifest
  --qa                      QA mode.
  --version                 Displays version of this package
  --pdf                     Output to PDF
  --html                    Output to HTML
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
Options can be applied to an individual input or at a globally to apply to all inputs
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
### Global only options
Global options cannot be applied to individual inputs. They must be added to the top level of the manifest.
#### QA Mode
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
#### Merged file TOC
```yaml
 mergedTOC: true
```
Set where you would like for the TOC to exist:
```html
<div class="toc" >
  <div>Course Contents</div>
  <!-- START auto-update -->
  <!-- START doctoc -->
  <!-- END doctoc -->
  <!-- END auto-update -->
</div>
```
#### Output to PDF or HTML
You can output to HTML or PDF. Pandoc is used to generate HTML and wkhtmltopdf is used to generate a PDF.

If you need to modify the HTML output, you can add pandoc parameters to the manifest. The `key` doesn't matter, only the `value` is evalutated based on [pandoc args](https://pandoc.org/MANUAL.html).
```yaml
 pandoc:
   latexTemplate: --template path/to/my/latex/template.latex
   css: -c path/to/my/css/main.css
```
> Caution: Input and output file locations/names cannot be changed through pandoc. This must be done by the manifest.output parameter.

if you need to modify the PDF output, you can add wkhtmltopdf options to the manifest. See [wkhtmltopdf options](https://www.npmjs.com/package/wkhtmltopdf#options) to learn more:
```yaml
 wkhtmltopdf:
  marginBottom: 1in
  marginTop: 1in
  pageSize: Letter
```
> Caution: The following options cannot be changes for wkhtmltopdf. This must be done by the manifest.output parameter.
>  * enableLocalFileAccess - always true for this module
>  * disableSmartShrinking - always true for this module
>  * output - can only be modified using manifest.output

Generate HTML only:
```shell
 merge-markdown -m manifest.md --html
```
Generate a PDF:
```shell
 merge-markdown -m manifest.md --pdf
```
Example files can be found in [test/pdf/src](test/pdf/src). You can also checkout a [working project](https://github.com/knennigtri/example-webpack-project) for css development using webpack.

## Manifest Examples

### YAML used as input
```yaml
---
input:
  frontmatter.md: ""
  file1.md: {noYAML: true, TOC: "#### Section Contents"}
  file2.md: {noYAML: true, TOC: "#### Section Contents"}
output: myOutput.md
---
```
### JSON used as input
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
  "output": "output/1/myOutput.md",
}
```
### Options applied to all files
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
### Apply custom HTML and PDF options
``` yaml
---
input:
 frontmatter.md: ''
 m1/m1-example.md: {noYAML: true, TOC: true, replace: {<!--#-->: "Module 1:"}}
 m2/m2-example.md: {noYAML: true, TOC: true, replace: {<!--#-->: "Module 2:"}}
output: "merged/myOutput.md"
pandoc:
 css: -c path/to/main.css
 title: -M title:Example
wkhtmltopdf:
 pageSize: Letter
 footerLine: true
 footerCenter: Page [page]
---
```
### Other Examples in the manifest
To See `qa` mode, `mergedTOC`, and other use cases see the [manifest-example.md](manifest-example.md)