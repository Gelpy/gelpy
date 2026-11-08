---
sidebar_position: 1
title: Documentation rules
description: How these docs grow with each feature, and what may be published.
---

# Documentation rules

## Closing rule

Every product spec ends with a documentation Work Item in this repository. That Work Item updates these docs when the feature reaches production, in the same release train.

- A feature is documented as available only after it reaches production. Until then, these docs call it planned.
- Each change updates the English page in `docs/` and its Spanish page in `i18n/es/` in the same pull request.
- Commands, paths, file names, and configuration keys stay untranslated.

## Framework rule

The [Agentic framework](../framework/overview.md) section describes the working method that builds Gelpy: roles, flows, and rules. It never describes operational data, such as secret names, build or session IDs, costs, or open risks.

- Every framework change updates this section in the same cycle.
- The section describes a method that is already in use, so the "planned until production" rule does not apply to it.

## What may be published

Publish:

- High-level architecture and data-flow diagrams
- Security posture and data-handling rules
- Product boundaries and the public roadmap
- The engineering method (the agentic framework), at the level of roles, flows, and rules

Never publish:

- Secrets, tokens, keys, or connection strings
- Internal hosts, test environments, or IP addresses
- Personal data, including email addresses and phone numbers
- Open or unresolved vulnerabilities
- Brand manual files, editable design files, or font files

## Public-safety check

`npm run check:public` scans everything the site publishes: `docs/`, `i18n/`, `docusaurus.config.js`, `sidebars.js`, and `static/`. It fails when it finds:

- Secrets, such as private keys, access tokens, API keys, or credentials in URLs
- Internal hosts, test environments, or IP addresses
- Links to hosts outside the public allowlist
- Email addresses or phone numbers
- Terms from private reference projects

The check runs in CI on every pull request and on every push to `main`. Reports hide most of each match, so logs never repeat a secret.

## Build rules

- `npm run build` builds English and Spanish and fails on any broken link.
- Use Node 22 (`.nvmrc`) and install with `npm ci`.
