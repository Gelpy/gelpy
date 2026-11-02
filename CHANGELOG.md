# Changelog

All notable changes to this repository will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Added

- Add Agent Docs instructions and the repo baseline.
- Add the Codex review rule.
- Add the Docusaurus site with English and Spanish locales, a build that fails on broken links, and the `docs.gelpy.app` domain.
- Add the `pages.yml` workflow that validates the build on pull requests and deploys to GitHub Pages on every push to `main`.
- Add the architecture overview, data flow, security overview, and documentation rules pages in English and Spanish, with Mermaid diagrams.
- Add `npm run check:public`, which fails on secrets, internal hosts or IP addresses, personal data, links outside the public allowlist, or private reference project terms in published content, and run it with its tests in CI.
