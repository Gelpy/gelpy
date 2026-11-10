---
sidebar_position: 1
title: Gelpy Agentic Framework
description: The working method that builds Gelpy, where one human owner directs a team of specialized AI agents.
---

# Gelpy Agentic Framework

The Gelpy Agentic Framework is the working method that builds Gelpy. One human owner directs a team of specialized AI agents, organized as a startup office with two areas, each led by a head. The agents plan, design, build, review, release, and document the product, and advise on the business. The owner coordinates and decides; the agents recommend, execute, and prove.

:::note Status

In use since 2026-10-31. Version 1.0 documented on 2026-11-08. Organized as a startup office on 2026-11-09.

:::

## Principles

Each principle comes from a rule that the agents follow.

1. **The owner decides.** Agents give a verdict per point on every request, and the owner chooses (`gelpy-challenge-request`).
2. **Spec first.** No substantial change starts without a Work Item with SMART acceptance criteria and a GitHub issue (ADR-0003).
3. **Design first.** No new screen, flow, or page is coded before the Product Designer designs it and the owner approves the design in writing.
4. **Evidence before Done.** Each criterion is checked and recorded as PASS, FAIL, or HUMAN PENDING before a Work Item is Done (`gelpy-verify-work-item`).
5. **Test before production.** Work reaches `staging` and the test environment first. Production releases need the owner's explicit approval (ADR-0005).
6. **Secrets never in code or chat.** Inventories hold names only, and agents never see values.
7. **One owner per repo.** Each repo has one specialized agent. Agents never edit another repo; they ask through the protocol.
8. **Bilingual memory.** English is canonical and Spanish is the companion. The owner works in Spanish (ADR-0007).

## Organization

The owner coordinates the two heads and is the only one who decides. Each head reports only to the owner.

```mermaid
flowchart TB
  owner([Owner<br/>coordinates and decides])

  subgraph product[Product and Engineering]
    tpm[Technical Product Manager<br/>the Master]
    subgraph platform[Platform]
      infra[Platform Engineer, DevOps<br/>Agent Infra]
      db[Database Engineer<br/>Agent DB]
      api[Backend Developer<br/>Agent API]
    end
    subgraph apps[Apps]
      app[Mobile Developer<br/>Agent App]
      web[Frontend Developer, web<br/>Agent Web]
      console[Frontend Developer, back office<br/>Agent Console]
    end
    subgraph designdocs[Design and Docs]
      ux[Product Designer, UX/UI]
      design[Design Systems Engineer<br/>Agent Design]
      docs[Technical Writer<br/>Agent Docs]
    end
  end

  subgraph business[Business]
    sm[Strategy Manager]
    legal[Legal Analyst<br/>Legal Peru]
    marketing[Growth Marketer<br/>Marketing]
    temp[On-demand roles<br/>at most 3 at a time]
  end

  codex[Codex<br/>Release Code Reviewer]

  owner <--> tpm
  owner <--> sm
  tpm --> platform
  tpm --> apps
  tpm --> designdocs
  tpm -.->|release PRs| codex
  sm --> legal
  sm --> marketing
  sm --> temp
  sm -->|REQUEST_CHANGE| tpm
  tpm -->|REQUEST_REVIEW or REQUEST_INFO| sm
```

- **Product and Engineering** is led by the **Technical Product Manager** (the Master). It owns the backlog, the specs, the proposed priorities, and delivery coordination. The owner sets product direction and approves architecture.
- **Business** is led by the **Strategy Manager** (the Business Coach), with the Legal Analyst and the Growth Marketer, plus on-demand roles.
- Teams have no lead and add no layer. The Technical Product Manager delegates to each repo agent directly.
- Work between the areas goes head to head. See [The agent team](./agents.md) for every role.

## Where it lives

The source of truth is the private `gelpy-architecture` repo. It holds:

- the `AGENTS.md` gate;
- the agent profiles under `.claude/agents/`;
- the skills under `codex/skills/`;
- the specs and Work Items under `specs/`;
- the ADRs under `adr/`;
- the governance scripts and `PROJECT_STATE.md`.

Each product repo has its own `AGENTS.md` gate, an agent profile, and a `codex/` router to the central skills. This site explains the method; it does not replace those files.

## In numbers

| Item | Count |
|------|-------|
| Agents | 13, plus Codex, plus on-demand roles |
| Skills | 23 |
| ADRs | 19 |
| Specs | 11 |
| Work Items in Phase 1 | About 170 |
| Repos | 8 |

## Glossary

| Term | Meaning |
|------|---------|
| Head | The lead of an area: the Technical Product Manager or the Strategy Manager |
| Work Item | The smallest tracked unit of work: one PR in one repo |
| AC | An acceptance criterion |
| Gate | A check that must pass before the next step |
| Release train | Coordinated `staging` → `main` releases across repos |
| OTA update | A JavaScript update that reaches installed apps without a store build |
| Handoff | The document that starts and records a long run of work |
| Verdict | The ✅/⚠️/❌ review of a request |

## Related pages

- [The agent team](./agents.md)
- [Skills](./skills.md)
- [Work Items and sprints](./work-items.md)
- [Delivery: gates, environments, and releases](./delivery.md)
- [Owner rules and safety](./rules.md)
- [Strategy Manager](./business-coach.md)
- [Origin and evolution](./evolution.md)
