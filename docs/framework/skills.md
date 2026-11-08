---
sidebar_position: 3
title: Skills
description: The 21 skills of the Gelpy Agentic Framework, what each one does, and which ones are mandatory.
---

# Skills

A skill is one `SKILL.md` file of packaged instructions for a repeatable job. The same file works for Claude Code and for Codex: each skill also has a small Codex metadata file. Repos point to the central catalog instead of copying it.

## The 21 skills

| Group | Skill | Purpose |
|-------|-------|---------|
| Governance and Work Items | `gelpy-analyze-requirement` | Classify a request and draft its spec, in English and Spanish |
| | `gelpy-plan-and-decompose` | Turn a spec into a plan and Work Items with SMART criteria, issues, and sprints |
| | `gelpy-track-work-item` | Work Item state, branch names, PR hygiene, issue sync |
| | `gelpy-orchestrate-agents` | Agent registry and message protocol |
| | `gelpy-scaffold-ecosystem` | Mandatory baseline files for a new repo |
| | `gelpy-update-docs` | Changelog, memory, ADRs, Spanish companions, and public docs after each change |
| | `gelpy-validate-compliance` | Audit repos against the framework |
| | `gelpy-self-improve` | Blameless retrospective that can change a rule |
| Critical review | `gelpy-challenge-request` | A strict verdict per point on every owner request and every `DELEGATE`: accept, accept with adjustments, or reject. The owner decides |
| Verification | `gelpy-verify-work-item` | Run each criterion's check and record PASS, FAIL, or HUMAN PENDING before Done |
| | `gelpy-codex-review` | Codex review on release PRs; P0, P1, and security findings block the merge |
| | `gelpy-audit-public-claims` | Evidence rules for public copy, scripts, and legal drafts |
| | `gelpy-validate-environment` | Check tools and access before setup or CI work |
| Release | `gelpy-release-version` | Mandatory at the start of every process: version decision, changelog, tags, Releases, version manifest |
| Brand and design | `gelpy-apply-brand` | Brand checklist for any visual surface |
| | `gelpy-design-web-experience` | UX foundation, then owner-approved design boards and a motion spec, all before code |
| | `gelpy-produce-motion-video` | HyperFrames video with the owner's AI voice; script, spend, and preview each need approval |
| Progress | `gelpy-progress-status` | Progress in percent per repo and in total, weighted by points |
| Business | `gelpy-business-coach` | Activate the Business Coach and its specialists |
| Platform | `gelpy-setup-infrastructure` | Cloudflare platform work |
| | `gelpy-init-api` | API foundations: Clean Architecture and the Result pattern |

## Mandatory skills

| Skill | When |
|-------|------|
| `gelpy-challenge-request` | Every owner request and every `DELEGATE` |
| `gelpy-release-version` | The start of every process |
| `gelpy-verify-work-item` | Before Done |
| `gelpy-apply-brand` | Any visual change |
| `gelpy-codex-review` | Release PRs |
| `gelpy-update-docs` | After every change |

## Related pages

- [Gelpy Agentic Framework](./overview.md)
- [The agent team](./agents.md)
- [Work Items and sprints](./work-items.md)
- [Origin and evolution](./evolution.md)
