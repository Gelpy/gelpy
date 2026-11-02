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
npm test           # Tests for the public-safety scan
```

`docs/` holds the English source. Spanish pages live in `i18n/es/docusaurus-plugin-content-docs/current/`.

## Validation

`npm run build`, `npm run check:public`, `npm test`

## Related Repos

See the ecosystem table in `gelpy-architecture/README.md`.

Agents start with [`AGENTS.md`](AGENTS.md).
