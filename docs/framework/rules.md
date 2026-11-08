---
sidebar_position: 6
title: Owner rules and safety
description: What the owner always approves, when agents stop, how secrets are handled, and the ADRs behind the framework.
---

# Owner rules and safety

## Verdict per point

Every owner request gets a strict expert verdict per point, each with its reason:

- ✅ accept as-is;
- ⚠️ accept with adjustments;
- ❌ reject.

The owner decides. Repo agents apply the same review to every `DELEGATE`.

## What the owner always approves

- The design of every screen and page, in writing, before code.
- Every merge to `main` in a deployable repo, which means production.
- Spending: native builds, paid services, AI voice credits.
- Weakening an acceptance criterion.
- Anything that touches personal data.
- Every ⚠️ or ❌ verdict.

## Stop conditions

An agent stops and asks the owner when:

- a gate fails;
- money must be spent;
- production would be touched outside an approved release;
- a criterion would have to be weakened;
- secrets or personal data appear.

## Working with the owner

- In Spanish.
- One owner action per message, and few messages.
- A plan before execution, which the owner approves.
- Scheduled tasks for actions tied to a time.
- The design boards are always current: a visible change updates its board in the same PR.
- **Autonomy first.** Before asking the owner for anything, an agent checks whether its own tools and read-only access can do it. When they cannot, it asks for the smallest access. The owner enters it in a secure form or a provider dashboard, never in chat.

## Secrets policy

- Secrets never go in code, chat, logs, issues, or docs.
- Inventories list secret names only, never values.
- Runtime secrets are set per Worker.
- Deploy credentials live only in production build settings, entered by the owner.
- PR and preview builds never receive deploy tokens.
- Agents never see secret values.
- Read-only credentials for the Master are injected by the platform's network proxy, never pasted.
- A secret found anywhere stops the work.

## What this site never publishes

- Secrets
- Internal hosts
- Personal data
- Open vulnerabilities
- Brand manuals or editable files

See [Documentation rules](../contributing/documentation-rules.md) for the full list and the check that enforces it.

## ADRs

| ADR | Title |
|-----|-------|
| 0001 | Record architecture decisions |
| 0002 | Repository ecosystem and framework exceptions |
| 0003 | Backlog traceability and SMART acceptance criteria |
| 0004 | Release and versioning |
| 0005 | Environments and branching |
| 0006 | Cloudflare cloud platform |
| 0007 | Documentation language strategy |
| 0008 | Agent orchestration governance |
| 0009 | Database schema source of truth |
| 0010 | Brand and design system |
| 0011 | Quality and security gates |
| 0012 | Automatic Codex review (amended: release PRs only) |
| 0013 | Website stack: Nuxt SSG, web motion, and HyperFrames media |
| 0014 | Migration credentials in GitHub Environments |
| 0015 | Coverage gate: 90% minimum, 95% target |
| 0016 | API connects to Postgres through the provider pooler, without Hyperdrive |
| 0017 | CI/CD pipeline policy: validate once, deploy on merge, no deploy secrets in PRs |
| 0018 | CI/CD on Cloudflare Workers Builds |

## Related pages

- [Gelpy Agentic Framework](./overview.md)
- [Delivery: gates, environments, and releases](./delivery.md)
- [Security overview](../security/overview.md)
- [Documentation rules](../contributing/documentation-rules.md)
