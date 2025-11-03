# syntax=docker/dockerfile:1

FROM node:20-bullseye

# Image environments
ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive

# Versions of the tools
ARG MERGE_MARKDOWN_VERSION
ARG DOCTOC_VERSION=2.2.1
ARG PANDOC_VERSION=2.19.2-1
ARG WKHTMLTOPDF_VERSION=0.12.6.1-2

# Install the needed packages
RUN apt-get update && apt-get install -y vim curl tzdata bash locales xfonts-75dpi xfonts-base zip

RUN arch=$(arch | sed s/aarch64/arm64/ | sed s/x86_64/amd64/) && \
    wget "https://github.com/jgm/pandoc/releases/download/2.19.2/pandoc-${PANDOC_VERSION}-${arch}.deb" && \
    dpkg -i "pandoc-${PANDOC_VERSION}-${arch}.deb" && \
    rm -rf "pandoc-${PANDOC_VERSION}-${arch}.deb" && \
    wget "https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-2/wkhtmltox_${WKHTMLTOPDF_VERSION}.bullseye_${arch}.deb" && \
    dpkg -i "wkhtmltox_${WKHTMLTOPDF_VERSION}.bullseye_${arch}.deb" && \
    rm -rf "wkhtmltox_${WKHTMLTOPDF_VERSION}.bullseye_${arch}.deb"

# Install the desired npm packages
RUN npm install --omit=dev -g @knennigtri/merge-markdown@${MERGE_MARKDOWN_VERSION} doctoc@${DOCTOC_VERSION}

# Switch to runner user
USER root

WORKDIR /home/runner/workspace
RUN mkdir cli

COPY --chown=root:root . /home/runner/workspace