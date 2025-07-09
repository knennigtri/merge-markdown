---
title: Lorem Ipsum One
description: Etiam a fermentum nibh. Fusce molestie vitae nulla a mollis. Quisque lectus neque, faucibus in interdum in, dignissim a enim. Nullam at ex at felis rhoncus sodales
subject: module subject
editor: https://typora.io/
typora-copy-images-to: ../../assets
---


# [#]:  Asset Links

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur egestas dapibus ex, vel ultrices dui posuere id. 

<!-- START doctoc -->
<!-- END doctoc -->
<!--{returnToMainTOC}-->

## [#]: Relative Asset Links

Making sure Asset links are correctly translated into absolute paths

#### Typical Links

With ![altText]

![sample-image](../../assets/sample-image.png)

Without ![]

![](../../assets/sample-image.png)

< img style="zoom:50%" / >

<img src="../../assets/sample-image.png" style="zoom:50%;" />

#### Links Directly after each other

![markdown]

![cover-image1](../../assets/cover_image.png)
![cover-image2](../../assets/cover_image.png)

< img / >

<img src="../../assets/sample-image.png" alt="sample-image" style="zoom:50%;" />
<img src="../../assets/sample-image.png" alt="sample-image" style="zoom:50%;" />

#### < img / > Variants

50% Zoom

<img src="../../assets/sample-image.png" style="zoom:50%;" />

50% Zoom

<img src="../../assets/sample-image.png"  style="zoom:10%;" />

No Zoom

<img src="../../assets/sample-image.png" />

## [#]: Absolute Asset Links

![markdown]

![sample-image](/Users/nennig/Documents/GitHub/knennigtri/merge-markdown/test/assets/sample-image.png)

< img / >

<img src="/Users/nennig/Documents/GitHub/knennigtri/merge-markdown/test/assets/sample-image.png" style="zoom:50%;" />


## [#]: Broken Links

Too Deep

![sample-image](../../../assets/sample-image.png)

Too Shallow

![](../assets/sample-image.png)

File only

<img src="sample-image.png" style="zoom:50%;" />


## [#]: Images in a list

#### No Space

1. Duis et justo ornare, scelerisque ligula eu, mattis lacus.
2. Donec quis lectus ac ligula ultricies suscipit sed convallis nunc.
   <img src="../../assets/sample-image.png" alt="sample-image" style="zoom:50%;" />
3. Pellentesque ac est id lorem cursus fringilla a sit amet diam.
4. ![markdown].
  ![](../../assets/sample-image.png)
5. Donec quis lectus ac ligula ultricies suscipit sed convallis nunc.

#### Surrounded by \n

1. Duis et justo ornare, scelerisque ligula eu, mattis lacus.
2. < img >.
  
   <img src="../../assets/sample-image.png" alt="sample-image" style="zoom:50%;" />

3. Pellentesque ac est id lorem cursus fringilla a sit amet diam.
4. ![markdown].
   
  ![](../../assets/sample-image.png)
   
5. Donec quis lectus ac ligula ultricies suscipit sed convallis nunc.