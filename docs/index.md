---
slug: /
sidebar_position: 1
title: Introduction
---

# Gelpy Engineering

Gelpy connects general-services professionals with people who need help, with safety and trust.

This site holds Gelpy's public engineering documentation. It covers high-level architecture, data flow, security posture, and the engineering method. Phase 1 builds the application base only.

## Start here

- [Architecture overview](./architecture/overview.md): components, platform, environments, and release flow.
- [Data flow](./architecture/data-flow.md): how requests and data move through the system.
- [App shell](./architecture/app-shell.md): navigation, onboarding, languages, and themes in the app.
- [Security overview](./security/overview.md): security posture and data-handling rules.
- [Identity and sign-in](./security/identity.md): registration, sign-in, the admin console, and identity data.
- [Agentic framework](./framework/overview.md): the working method that builds Gelpy, with one human owner and a team of AI agents.
- [Documentation rules](./contributing/documentation-rules.md): how these docs grow and what may be published.

## How this site works

- The `docs/` folder in the [Gelpy/gelpy](https://github.com/Gelpy/gelpy) repository is the source.
- English is the default language. Spanish pages live under `i18n/es`.
- Every merge to `main` builds and publishes the site, and mirrors these pages into the repository's wiki. The build fails on any broken link.

## Who leads this work

**Edgardo Gutierrez**, Co-founder, CTO, and Forward Deployed Engineer (FDE). He leads Gelpy's engineering.

Website: [edgardo-gutierrez.com](https://edgardo-gutierrez.com)

Gelpy is a product of Analytic's & Code Associates S.A.C.
