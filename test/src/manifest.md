---
input:
 frontmatter.md: ""
 preamble.md: ""
 lorem-module.md: {noYAML: true, TOC: true}
 ipsum-module.md: {noYAML: true, TOC: true}
 etiam-module.md: {noYAML: true, TOC: true}
output: +myYAMLGuide.md
qa: {exclude: "(frontmatter|preamble)"}
replace:
 /<!--{timestamp}-->/g: true
 courseTitle: My Course Title
 author: Chuck Grant
---

## This is something
blah blah blah