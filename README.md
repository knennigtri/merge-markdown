# merge-markdown
Takes in a list of markdown files and merges them together

## Installation
To install the command line tool globally, run:

```shell
npm install -g merge-markdown
```

To add the module to your project, run:

```shell
npm install --save-dev merge-markdown
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
  -q                   Sets the markdown link checker to quiet. (does not output success links)
  -h                   Displays this screen
  -v                   Displays version of this package
```

## manifest file format

`manifest.json`:
This file should be in project directory where markdown files are to be merged

* `input`: An array of markdown files within the local project. These can be relative paths.
* `output`: path/name.md of the resultant file of the merge. The path/ should be the same level deep as the markdown files to maintain asset references.
* `quiet`: not implemented yet

**Examples:**

```json
{
  "input": [
    "file1.md",
    "file2.md"
  ],
  "output": "myOutput.md",
  "quiet": true
}
```
```json
{
  "input": [
    "folder1/file1.md",
    "folder2/file2.md"
  ],
  "output": "output/myOutput.md",
  "quiet": true
}
```
```json
{
  "input": [
    "folder1/folder1/file1.md",
    "folder2/folder2/file2.md"
  ],
  "output": "output/1/myOutput.md",
  "quiet": true
}
```