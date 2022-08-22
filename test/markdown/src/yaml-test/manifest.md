---
input:
  frontmatter.md:
    replace: {"<!--{timestamp}-->": 05/02/21}
  hasYAML.md: {noYAML: true, TOC: true}
  noYAML.md: {noYAML: true, TOC: true}
  badYAML.md: {noYAML: true, TOC: true}
output: ../merge/yamlRemove.md
---
