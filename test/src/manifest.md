---
input:
	frontmatter.md:
	lorem-module.md: {noYAML: true, TOC:true}
	ipsum-module.md: {noYAML: true, TOC:true}
	etiam-module.md: {noYAML: true, TOC:true}
output: +myGuide.md
replace:
	timestamp: true
	courseTitle: My Course Title
	author: Chuck Grant
---
