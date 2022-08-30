---
input:
 ../../frontmatter.md: ''
 m1/m1-example.md: {noYAML: true, TOC: true, replace: {<!--#-->: "Module 1:"}}
 m2/m2-example.md: {noYAML: true, TOC: true, replace: {<!--#-->: "Module 2:"}}
output: "merged/myOutput.md"
qa: {exclude: "(frontmatter)"}
replace:
 <!--{copyrightYear}-->: 2022
 <!--{timestamp}-->: 10/22/2022
 <!--{returnToMainTOC}-->: "[Return to Course Contents](#course-contents)"
 <!--{courseType}-->: Activity Guide
 <!--{courseTitle}-->: My Course Title
 <!--{courseCreator}-->: The Merge Company
 <!--{author}-->: Ronan Boxer
mergedTOC: true
pandoc:
 css: -c path/to/main.css
 latexTemplate: --template path/to/template.latex
 title: -M title:Example
wkhtmltopdf:
 marginBottom: 1in
 marginTop: 1in
 marginLeft: .7in
 marginRight: .7in
 pageSize: Letter
 footerLine: true
 footerCenter: Page [page]
---