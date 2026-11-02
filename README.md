# gelpy

Public engineering documentation for Gelpy. This repo is public.

## Status

The Docusaurus site builds in English and Spanish and deploys to `https://docs.gelpy.app` through GitHub Pages. Implementation runs from `gelpy-architecture/handoffs/fase-1-corrida.md`.

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
```

The Gelpy theme comes from the private `@gelpy/design-system` package on GitHub Packages. With a token that can read it, export it as `NODE_AUTH_TOKEN` before `npm ci`. Without one, `npm ci` skips the package and the site builds with the default theme. CI sets `GELPY_REQUIRE_BRAND=1` on pushes and same-repo pull requests, so a missing theme fails there. Never commit a token: `.npmrc` only reads it from the environment.

`docs/` holds the English source. Spanish pages live in `i18n/es/docusaurus-plugin-content-docs/current/`.

## Validation

`npm run build`, `npm run check:public`, `npm run check:brand`, `npm test`

## Related Repos

See the ecosystem table in `gelpy-architecture/README.md`.

Agents start with [`AGENTS.md`](AGENTS.md).
