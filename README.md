# merge-markdown
Takes in a list of markdown files and merges them together
Available on NPM: https://www.npmjs.com/package/merge-markdown

## Installation
To install the command line tool globally, run:

```shell
npm install -g merge-markdown
```

## Command Line Tool

The command line tool optionally takes 1 argument, the file name or http/https URL.
If not supplied, the tool reads from standard input.

#### merges markdown files from a local project

```shell
merge-markdown -m manifest.json
```

#### Usage

```shell
Usage: merge-markdown [OPTIONS]
Options:
  -m manifestName      json file that contains build info. Default is manifest.json
  --options            Displays supported manifest {options}
  -q                   Sets the markdown link checker to quiet. (does not output success links)
  -h                   Displays this screen
  -v                   Displays version of this package
```

## manifest file format

`manifest.json`:
This file should be in project directory where markdown files are to be merged

* `input`: json object of markdown files within the local project. These can be relative paths.
  * `{options}`: Options that can be applied to individual files for merge preperation 
* `output`: path/name.md of the resultant file of the merge. The path should be the same level deep as the markdown files to maintain asset references.
* `{options}`: Options can also be applied to all files at a global level

### Supported `{options}`
* noYAML: optionlly removes YAML. Default=false
* TOC: optionally adds a TOC to this file with doctoc. Default=false. See https://www.npmjs.com/package/doctoc#specifying-location-of-toc 
* replace: searches for ${key} and replaces with "value"
  * timestamp: true for todays date or add you own timestamp string
  * *: replace any key string with the value string
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

Example of using a custom TOC title in a file.
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
Example of different options.
```json
{
  "input": {
    "folder1/file1.md": {"TOC":true},
    "folder2/file2.md": {"noYAML":true,"TOC":true}
  },
  "output": "output/myOutput.md"
}
```
Example of global options applied to all files
```json
{
  "input": {
    "folder1/file1.md": "",
    "folder2/file2.md": {"noYAML":true}
  },
  "output": "output/myOutput.md",
  "replace":{
		"timestamp":"06/01/2021",
	},
  "TOC": "#### Chapter contents"
}
```
Example of using custom replace statements. The markdown needs to have ${key} to replace the value.
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