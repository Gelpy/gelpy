# gelpy

Public engineering documentation for Gelpy. This repo is public.

## Status

The Docusaurus site builds in English and Spanish. Cloudflare Workers Builds builds it and the `gelpy-docs` Worker serves it at `https://docs.gelpy.app` (ADR-0018). Each merge to `main` also mirrors `docs/` into the GitHub wiki. Implementation runs from `gelpy-architecture/handoffs/fase-1-corrida.md`.

## Local Development

Use Node 22 (`.nvmrc`).

```bash
npm ci
npm start          # English
npm run start:es   # Spanish
npm run build      # Both locales; fails on broken links
npm run check:public  # Public-safety scan of published content
npm run check:brand  # No hard-coded colors or fonts, no font or source files
npm test           # Tests for the site scripts
npm run ci:local   # The whole local PR gate
npm run ci:evidence  # Runs ci:local and writes ci-evidence.md for the PR comment
```

The Gelpy theme comes from the private `@gelpy/design-system` package on GitHub Packages. With a token that can read it, export it as `GELPY_PACKAGES_TOKEN` before `npm ci`. Without one, `npm ci` skips the package and the site builds with the default theme. Workers Builds requires the theme (`GELPY_REQUIRE_BRAND=1`), so a missing theme fails there. Never commit a token: `.npmrc` only reads it from the environment.

`docs/` holds the English source. Spanish pages live in `i18n/es/docusaurus-plugin-content-docs/current/`.

## Validation

`npm run ci:local` runs `npm audit`, `npm test`, `npm run check:public`, `npm run check:brand`, the wiki build, `npm run build`, and a `wrangler deploy --dry-run`. Until 2026-11-30 ("MVP mode") the tests run only there: post `npm run ci:evidence` as a PR comment for the head SHA.

## Pipeline (Workers Builds)

One Worker, `gelpy-docs`, connected to this repo with production branch `main` and previews on. Every setting uses the same three commands (`scripts/workers-builds.mjs`):

| Command | PR branch | `main` |
|---|---|---|
| `npm run cf:build` | gitleaks over the PR's commits, then the build with `X-Robots-Tag: noindex` | The production build |
| `npm run cf:preview` | A Preview deployment, commented on the PR | Nothing |
| `npm run cf:deploy` | Refuses | Deploy, the live check, the GitHub Release `v<version>`, then the wiki sync |

- `GELPY_PACKAGES_TOKEN` (read-only packages) is the only secret of the preview settings.
- `GELPY_RELEASE_TOKEN` and `GELPY_WIKI_TOKEN` live only in the production settings. Without them, the release or the wiki sync is skipped with a log line.
- The release is created only when `CHANGELOG.md` has a section for the version in `package.json`; release PRs come from `release/vX.Y.Z`.
- The wiki is a generated mirror of `docs/` (`npm run wiki:build`). The sync is idempotent, logs page names only, and removes pages that `docs/` no longer has.
- `.github/workflows/pages.yml` is the failover: it runs only by hand, with its original triggers under `# FAILOVER`.

## Related Repos

See the ecosystem table in `gelpy-architecture/README.md`.

Agents start with [`AGENTS.md`](AGENTS.md).
