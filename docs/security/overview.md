---
sidebar_position: 1
title: Security overview
description: Gelpy's security posture, data handling rules, and quality gates.
---

# Security overview

Gelpy handles accounts and personal data, so security is part of every change from the start. This page describes the posture and the rules that every repository follows. It does not list open vulnerabilities, internal hosts, or secrets.

:::note Status

Phase 1 is in development. The rules on this page already apply to every Gelpy repository. Product capabilities marked as planned are not live yet.

:::

## Guiding frameworks

Gelpy's design follows these frameworks:

- OWASP Top 10
- Peru's personal data protection law (Ley 29733)
- GDPR principles
- SOC 2 practices

These guide the design. They are not a certification.

## Data classification

| Class | Examples | Handling |
|-------|----------|----------|
| Public | Engineering docs, website pages | Published openly after a public-safety check |
| Personal data | Name, email, phone number | Collected only when needed, stored in the production database only |
| Credentials | Password hashes, passkeys, tokens | Never logged, never returned by the API, never shown in docs |
| Secrets | API keys, signing keys, connection strings | Stored in the platform's secret store, never in source code |

## Authentication (planned)

- Sign-in with Google, or with email and password plus a one-time code.
- Optional biometric unlock on Android and server-verified passkeys on Android and web. People can revoke them.
- Passwords and one-time codes are stored only as hashes.
- Refresh tokens rotate on every use and stop working after sign-out.

## Secrets management

- Runtime secrets go in the Cloudflare secret store, per Worker and per environment.
- GitHub stores only deployment credentials: deploy tokens and, for schema migrations, a migration-only database credential in protected environments.
- Secrets never go into source code, docs, logs, or test fixtures.

## Logging rule

Logs never record passwords, one-time codes, tokens, or personal data.

## Environment isolation

Test and production are separate. Each has its own database, secrets, OAuth clients, and passkey configuration. Production personal data never goes into test.

## Quality and security gates

Every pull request must pass:

- Lint and type checks
- Tests with at least 90% coverage, with a 95% target
- A successful build
- `npm audit`
- Code review
- Accessibility and brand checks on visual repositories

## Public documentation rule

This site publishes high-level architecture, data flow, and security posture only. Before publishing, `npm run check:public` scans the site content and fails on secrets, internal hosts or IP addresses, or personal data. See [Documentation rules](../contributing/documentation-rules.md).

## Reporting a vulnerability

Do not report a suspected vulnerability in a public issue, pull request, or discussion. A private reporting channel will be published here.

## Related pages

- [Architecture overview](../architecture/overview.md)
- [Data flow](../architecture/data-flow.md)
