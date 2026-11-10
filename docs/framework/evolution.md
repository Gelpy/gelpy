---
sidebar_position: 8
title: Origin and evolution
description: Where the Gelpy Agentic Framework came from, what Gelpy added, and how the framework keeps evolving.
---

# Origin and evolution

## Origin

The framework began as a copy of the AI-Driven Framework that Gelpy's CTO built for an earlier project, Portfolio Tracker ([public docs](https://docs.portfolio-tracker.us/)). Gelpy adopted its gates on 2026-10-31 and has evolved it since.

Portfolio Tracker is never a visual or product reference for Gelpy. Only the method was reused.

## What the base had

From the base's public framework page:

- an AI-driven workflow with local Spec Kit files;
- a Work Item gate: one local Work Item, a GitHub issue reference, a scoped `codex/` branch, one Work Item per PR, validation evidence, and changelog and memory updates;
- `tasks.md` as the state source, with no issue sync;
- a catalog of 10 skills: environment validation, ecosystem scaffolding, infrastructure setup, API initialization, requirement analysis, planning, Work Item tracking, compliance validation, documentation updates, and release and versioning;
- ADRs, a version manifest, and bilingual docs;
- version bumps in PRs, with tags created in CI;
- a single executor, Codex, with repo entrypoints pointing to the catalog;
- local infrastructure (Docker) and a local code-quality server.

## What Gelpy added

| Dimension | Base | Gelpy |
|-----------|------|-------|
| Executors | One AI executor | A startup office of 13 agents in two areas, Product and Engineering and Business, each led by a head, in parallel cloud sessions, with Codex as release code reviewer |
| Coordination | — | A message protocol, `STATUS` replies, and verified transfers between sessions |
| Skills | 10 | 23; adds orchestrate, challenge-request, verify, codex-review, apply-brand, design-web-experience, design-product-experience, produce-motion-video, audit-public-claims, progress-status, business-coach, and self-improve, among others |
| Owner review | — | A strict verdict per point on every request and every delegation |
| Issues | References only | Status mirrored in labels and closing, Epic → Feature → Work Item sub-issues, and milestones |
| Planning | Work Items | 1-week sprints, points, and percent progress per repo |
| Verification | Validation evidence | Measure, Check, and Verified by per criterion, a lint for vague words, and PASS/FAIL/HUMAN PENDING before Done |
| Delivery | Local infrastructure and CI | Cloud only: Cloudflare Workers Builds, `staging`/`main` release trains, preview deploys with `noindex`, and mobile channels with OTA updates |
| Review | Local code-quality server | SonarCloud on every PR, gitleaks, 90% coverage, and Codex on release PRs |
| Design | — | Design first: a Product Designer designs every new screen or flow with all its states, the owner approves it in writing before code, and a versioned design-system package |
| Business | — | A Business area led by the Strategy Manager, with the Legal Analyst, the Growth Marketer, on-demand roles, and a case memory |
| Branches | `codex/` | `claude/` and `codex/` |

## Timeline

| Date | Change |
|------|--------|
| 2026-10-31 | Gelpy adopts the base framework's gates |
| 2026-11-08 | Version 1.0 documented on this site |
| 2026-11-09 | The agents are organized as a startup office: two heads, office roles, teams without a lead, and a Product Designer |

## Lessons learned

1. **Preview builds never hold deploy tokens.** Any branch can run code in a preview build, so a token there could publish to production. PR previews are published on demand instead.
2. **Verify the tree in every transfer.** A checksum manifest plus the git tree hash make a hand-off between sessions exact.
3. **Read the evidence, not the report.** The Technical Product Manager audits diffs, logs, and live responses before it merges or reports.
4. **Status lines age.** Before reporting progress, check each Work Item against git, Releases, and live checks. A review on 2026-11-08 found 2 items already done.
5. **One PR in flight per repo** avoids conflicts and makes every merge auditable.
6. **Design approved before code** avoids rework on screens.

## How it keeps evolving

- `gelpy-self-improve` retrospectives can change a rule.
- Durable decisions become ADRs or ADR amendments.
- Every framework change updates this section in the same cycle (`gelpy-update-docs`).

## Related pages

- [Gelpy Agentic Framework](./overview.md)
- [Skills](./skills.md)
- [Owner rules and safety](./rules.md)
