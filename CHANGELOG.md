# Changelog

All notable changes to this repository will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Added

- Add Agent Docs instructions and the repo baseline.
- Add the Codex review rule.
- Add the Docusaurus site with English and Spanish locales, a build that fails on broken links, and the `docs.gelpy.app` domain.
- Add the `pages.yml` workflow that validates the build on pull requests and deploys to GitHub Pages on every push to `main`. It now runs only by hand, as the failover of Workers Builds.
- Add the architecture overview, data flow, security overview, and documentation rules pages in English and Spanish, with Mermaid diagrams.
- Add `npm run check:public`, which fails on secrets, internal hosts or IP addresses, personal data, links outside the public allowlist, or private reference project terms in published content, and run it with its tests in CI.
- Apply the Gelpy brand theme from `@gelpy/design-system@0.1.0`: light and dark colors, type weights, and radii from its tokens, and the logo and favicon from its assets. Assets are copied into the build output only. CI installs the private package with a read-only token on pushes and same-repo pull requests and fails if the theme is missing there; fork pull requests build with the default theme.
- Add `npm run check:brand`, which fails on hard-coded colors or font families in site code and on tracked font files, brand manuals, or editable sources.
- Underline links inside page text so they do not rely on color alone.
- Add the app shell page in English and Spanish: the three tabs, the onboarding redirect, languages, themes, and screen sizes. The shell runs in production on the web; Android is in preview.
- Build and serve the docs with Cloudflare Workers Builds and the static-assets Worker `gelpy-docs` on `docs.gelpy.app` (Work Item 003-025): `npm run cf:build`, `cf:preview`, and `cf:deploy`; gitleaks and a noindex Preview URL on every PR; the deploy, a live check (`check:public --live`), and the GitHub Release `v<version>` on `main`. Feature PRs merge straight to `main`, so the release step skips with a log line while `CHANGELOG.md` has no section for the version, and turns the build red on an API error, an empty section, or a missing commit SHA.
- Mirror `docs/` into the GitHub wiki on every deploy of `main` (Work Item 004-002): `npm run wiki:build` generates the English and Spanish pages, a sidebar, and a footer; the sync is idempotent and logs page names only.
- Add `npm run ci:local` and `npm run ci:evidence`, the local PR gate of MVP mode.
- Scan every `main` build with the pinned gitleaks over the pushed commits (`HEAD^1..HEAD`) before the site build (Work Item 003-037).
- Add the "Agentic framework" section in English and Spanish (Work Item 001-021): 8 pages on the working method that builds Gelpy, covering the overview, the agent team, skills, Work Items and sprints, delivery, owner rules and safety, the Business Coach, and the framework's origin and evolution, with Mermaid diagrams. The section sits at position 4 and Contributing moves to 5. The home page links it, the documentation rules and `AGENTS.md` add the engineering method to the publishable scope, and `check:public --live` also checks the framework overview in both languages. `check:public` lets the origin page alone name the base project and link its public docs.

### Changed

- Show the startup organization in the "Agentic framework" section in English and Spanish (Work Item 001-025): two heads, the Technical Product Manager and the Strategy Manager, office roles, teams without a lead, the Product Designer, the organization rules, the `gelpy-design-product-experience` skill, the new counts, and a 2026-11-09 timeline entry. The Business Coach page is titled Strategy Manager and keeps its URL.
- Mark identity as in production on the web on the identity page in English and Spanish (Work Item 007-008): in the web version of the app and in the admin console, email and password, Google, phone by SMS, and passkeys run in production since 2026-11-07. Google on Android, fingerprint unlock, and passkeys on Android stay in the Android preview build until the first production Android build.
- The release step of `main` requires `GELPY_RELEASE_TOKEN` on every deploy and checks the tag `v<version>` (Work Item 003-037):
  - A merge that changes the `package.json` version is a release: the tag must be missing or at the deployed commit, and the `CHANGELOG.md` section must exist.
  - A merge that keeps the version creates no release.
  - A release whose tag is missing is always red.
- Steps that call Cloudflare stop their whole process tree when they run out of time (Gelpy/gelpy#22).
- The live check falls back to DNS over HTTPS when the build's resolver still caches a "no such name" from a first cutover (Gelpy/gelpy#22).
- Add the identity and sign-in page in English and Spanish: account types, email and password with a confirmation link, Google, phone by SMS, sessions, fingerprint unlock, passkeys, the admin console, and data handling, each with its status. Update the sign-in sections of the data flow and security overview pages to match.
