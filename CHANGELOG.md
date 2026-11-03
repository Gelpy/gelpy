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
- Apply the Gelpy brand theme from `@gelpy/design-system@0.1.0`: light and dark colors, type weights, and radii from its tokens, and the logo and favicon from its assets. Assets are copied into the build output only. CI installs the private package with a read-only token on pushes and same-repo pull requests and fails if the theme is missing there; fork pull requests build with the default theme.
- Add `npm run check:brand`, which fails on hard-coded colors or font families in site code and on tracked font files, brand manuals, or editable sources.
- Underline links inside page text so they do not rely on color alone.
- Add the app shell page in English and Spanish: the three tabs, the onboarding redirect, languages, themes, and screen sizes. The shell runs in production on the web; Android is in preview.
