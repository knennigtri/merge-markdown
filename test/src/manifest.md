---
input:
 frontmatter.md: ""
 preamble.md: ""
 lorem-module.md: {noYAML: true, TOC: true}
 ipsum-module.md: {noYAML: true, TOC: true}
 etiam-module.md: {noYAML: true, TOC: true}
output: output/+myYAMLGuide.md
qa: {exclude: "(frontmatter|preamble)"}
replace:
 <!--{timestamp}-->: 05/25/2021
 <!--{returnToMainTOC}-->: "[...back to main TOC](#course-contents)"
 <!--{courseTitle}-->: My Course Title
 <!--{author}-->: Chuck Grant
 ({#(.*?)}): ""
---

## This could be information that explains the merge above
The merge above:
 1. Uses a generic frontmatter.md file that is globally updated by the replace statements
 2. preamble.md doesn't exist to prove that the file will be skipped
 3. The next 3 modules all have local replace statements to remove YAML if it exists and add a TOC if the identifiers are found
 4. If someone wanted to run --qa on this manifest, it would exclude any files with frontmatter and preamble in the file names