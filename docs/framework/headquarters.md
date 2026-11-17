---
sidebar_position: 2.5
title: Headquarters reporting
description: How agent messages become a business timeline without changing the communication protocol.
---

# Headquarters reporting

Headquarters is the planned internal office view for the business owners. It follows real agent sessions and their work through the [message protocol](./agents.md#message-protocol). It is a monitoring view: instructions, approvals, and decisions stay in the original chats.

:::note Status

Implementation planned in Sprint 3. This page defines the reporting contract; it does not claim that the office or its integrations are available in production.

:::

## The same messages, with a trace

Agents keep using `DELEGATE`, `REQUEST_CHANGE`, `REQUEST_REVIEW`, `REQUEST_INFO`, `NOTIFY_COMPLETE`, `NOTIFY_BLOCKED`, and the `STATUS` replies `ACCEPTED`, `COMPLETED`, `BLOCKED`, or `NEEDS_INFO`. Reporting records a business summary of each message; it does not send a second instruction or replace the message transport.

| Protocol message | What the owners should understand |
|---|---|
| `DELEGATE` | Who assigned the work, to whom, and its objective |
| `REQUEST_CHANGE` | Which team needs an adjustment from another team |
| `REQUEST_REVIEW` | Which delivery is ready for review |
| `REQUEST_INFO` | What information is missing to continue |
| `NOTIFY_COMPLETE` | What the agent reports it has delivered |
| `NOTIFY_BLOCKED` | What prevents the work from continuing |
| `STATUS` | Whether the recipient accepted, answered, finished its part, or needs help |

The sender reports a message after the transport confirms the send. A failed send is recorded as a delivery failure, never as a successful conversation. Each reply has its own event, linked to the original message and task. Retries reuse the event identifier so that one message produces one timeline entry. A reporting outage must not stop the original communication; the emitter retries later.

```mermaid
flowchart LR
  sender[Sending agent] -->|Existing protocol| recipient[Receiving agent]
  sender -->|Confirmed send: business summary| history[Durable event history]
  recipient -->|Correlated reply summary| history
  history --> office[Read-only office and timeline]
  failed[Failed delivery] -->|Failure event| history
```

## Report business progress

The planned office has one robot per session, with an appearance for its role. The Technical Product Manager and Strategy Manager share an office. A confirmed message represents a visit to the recipient; its reply represents the return conversation. The robot's panel brings together the objective, current activity, latest result, next step, and timeline. Sessions working on the same task remain distinct and can be viewed together.

A useful summary says, for example, “Preparing the reservation notices; waiting for the approved wording.” It explains the result or the missing decision in business language. It does not copy the full `Context`, `Dependencies`, or `Artifacts` fields. Presence, pause, resume, and session-close events complement the protocol; a heartbeat alone is not proof of progress.

The planned service has a single office in production. Events can describe work on `staging`; the work's branch and the place where owners view its events are different concepts. The reporting contract covers Claude and Codex sessions, but each integration needs a real message-and-reply check before it is described as operational.

## Times and completion mean different things

| Display | Meaning |
|---|---|
| Elapsed time | Time since the assignment, including waits |
| Observed active time | Activity supported by session signals, excluding pauses and stale intervals |
| Waiting time | Time explicitly waiting for information, a review, or a decision |
| No update | The last signal is too old to claim current activity |

A `NOTIFY_COMPLETE` or `STATUS: COMPLETED` is the agent's report. It does not mark a Work Item `Done`. Acceptance criteria, evidence, and any human approval are still checked through [Work Items and sprints](./work-items.md).

## Keep the record limited

The reporting contract permits task and session identifiers, roles, dates, message relationships, and short business summaries. It excludes raw conversations, files, code, command output, credentials, and customer data. Access is restricted to authorized owners; the view does not grant permission to instruct an agent or approve a release.

Detailed events are planned to expire after 90 days. Daily result and time summaries are planned to expire after one year. These records support internal operational monitoring; the feature does not add advertising, third-party analytics, or session replay.
