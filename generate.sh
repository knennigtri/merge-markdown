# !/bin/bash -x

# https://github.com/thlorenz/doctoc


defaultOPath="output/"
defaultOName="studentGuide"
defaultManifest="manifest.txt"
TOCTITLE="#### Module Contents"
quiet=""

# -m sets the manifest that contains an ordered list of modules
# -p Specifys the input path of the module location
# -q TRUE sets the markdown link checker to quiet. (does not output success links)
outputPath=${defaultOPath}
outputName=${defaultOName}
manifest=$defaultManifest
inputPath=""
while getopts m:p:q: flag
do
    case "${flag}" in
        m) manifest=${OPTARG};;
        p) inputPath=${OPTARG};;
        q) quiet="-q";;
    esac
done
outputPath="${defaultOPath}"
if [[ $inputPath != "" ]]; then
	outputName="${inputPath%/}"
	manifest="${inputPath%/}/${manifest}"
fi

[ ! -f $manifest ] && echo "$manifest does not exist. Use -m to specify a file."	 && exit 1
echo "Using Manifest: $manifest"

outputFile="${outputPath%/}/${outputName}.md"
echo "Markdown Output File: $outputFile"

# Setup linkcheck file
linkcheckFile="${outputPath%/}/${outputName}.linkcheck.md"
echo "QA Linkcheck File: $linkcheckFile"
rm -v $linkcheckFile

# Read all lines of the manifest and prepare the markdown
# -Remove YAML from all files except the first one
# -Add a TOC to files that request one generated
FILE_LIST=""
while IFS= read -r FILE
do
  if [[ $FILE != "" ]]; then
      [[ ${inputPath} != "" ]] && FILE="${inputPath%/}/${FILE}";
      echo "********** $FILE **********"
      scrubbedFile="$FILE.temp"
      # Removes YAML from all files except the first file and *ref.md files
      if [[ $FILE == *"frontmatter"* ]]; then
        echo "Creating temp file for $FILE"
        cp "$FILE" "$scrubbedFile"
        FILE_LIST+=" $scrubbedFile"
      elif [[ $FILE == *"*.ref.md"* ]]; then
          echo "Adding .ref.md file(s) to build list"
          FILE_LIST+=" **/*.ref.md"
      else
        echo "Removing YAML from $FILE"
        sed '/^---$/,/^---$/d' $FILE > ${scrubbedFile}
        FILE_LIST+=" $scrubbedFile"
        ## Adds a manually generated TOC to modules
        doctoc -u --title "$TOCTITLE" --maxlevel 3 $scrubbedFile
        ## Checks all links within the markdown file and outputs the results
        markdown-link-check ${quiet} -c config.json $scrubbedFile | tee -a "${linkcheckFile}" >/dev/null
      fi
  fi
done < $manifest

echo "********** Ordered List of Files to be merged **********"
echo "$FILE_LIST"

# Creates a FINAL markdown file for the course
mkdir -p $outputPath
echo "Markdown Output File: $outputFile"
rm -v $outputFile
cat $FILE_LIST > $outputFile
echo "$outputFile has been created."

# Remove all .temp files used
find . -name '*.temp' -delete
