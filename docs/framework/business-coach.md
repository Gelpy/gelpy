---
sidebar_position: 7
title: Business Coach
description: The owner's advisor on startup strategy in Peru, its specialist team, its evidence rules, and its limits.
---

# Business Coach

The Business Coach is the owner's advisor on startup strategy in Peru: validation, marketplace economics, growth, and financing.

## How to call it

The owner asks for "Business Coach" explicitly, or the Master delegates a business question. The Master stays the default for technical work.

## Team

- Legal Peru
- Marketing
- Temporary specialists, with one discipline and one question each

At most 3 run in parallel. Specialists never delegate further. Real subagent runs are recorded with their IDs. Without tools, the Coach says the review was sequential.

## Evidence rules

- Separate facts, assumptions, and gaps.
- Use official and primary sources, such as Peruvian law from the official gazette and the data-protection authority.
- Give alternatives with their costs.
- Name the next validation: hypothesis, metric, threshold, and deadline.
- Record the owner's decision.

## Case memory

Each case has a brief, an analysis, and a decision, in Spanish. The decision is written only when the owner has actually decided. Cases hold no personal data.

## Limits

- Advice never authorizes implementation, spending, publication, or production.
- A legal text is a draft until a lawyer approves it in writing.
- Engineering needs go to the Master as a `REQUEST_CHANGE`.

## A real example

Legal Peru drafted Gelpy's privacy, cookies, and terms texts from primary Peruvian sources. It separated verified facts from questions for a lawyer. The drafts carry a "Draft under review" notice until a lawyer approves them. Today they are in the test environment only.

## Flow

```mermaid
flowchart TB
  question([Owner question]) --> verdict[Coach: verdict per point]
  verdict --> specialists[Specialists, in parallel]
  specialists --> consolidate[Coach consolidates]
  consolidate --> decide{Owner decides}
  decide --> record[Decision recorded]
  record -.->|if engineering is needed| change[REQUEST_CHANGE to the Master]
```

## Related pages

- [Gelpy Agentic Framework](./overview.md)
- [The agent team](./agents.md)
- [Owner rules and safety](./rules.md)
