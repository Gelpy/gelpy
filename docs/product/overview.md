---
sidebar_position: 1
title: What Gelpy does today
description: What people can do with Gelpy in production today, and what is planned.
---

# What Gelpy does today

Gelpy connects general-services professionals with people who need help at home, with safety and trust. This section describes the product from the point of view of the people who use it: what they can do, who can do it, and whether it is live.

:::note Status

State on 2026-11-14. Only what runs in production is described as available. Everything else is marked as planned, and this section changes when it reaches production.

:::

## Words used here

| Word | Meaning |
|------|---------|
| Gelpie | A person who needs help: the client |
| Gelper | A professional who offers a service |
| Team | The Gelpy staff who run the platform from the admin console |

## Where Gelpy runs

| Surface | Who uses it | In production |
|---------|-------------|---------------|
| The Gelpy app on the web | Gelpies and Gelpers | Since 2026-11-03 |
| The Gelpy app on Android | Gelpies and Gelpers | Since the first production build of 2026-11-08, installed as an APK; the app is not on Google Play |
| The website | Anyone | Since version 0.6.0 of 2026-11-08, with its legal pages |
| The admin console | The Gelpy team | Since 2026-11-07 |

## What people can do today

| What | Who | Where |
|------|-----|-------|
| Create an account with email and password or with Google, as a Gelpie, a Gelper, or both | Anyone | App, web and Android |
| Sign in with email and password or with Google | Gelpies and Gelpers | App, web and Android |
| Sign in with a passkey, and create, list, and revoke passkeys | Gelpies and Gelpers | App, web |
| Add a phone number and verify it by SMS | Gelpies and Gelpers | App, web and Android |
| Unlock the app with a fingerprint or the face | Gelpies and Gelpers | App, Android |
| Turn on the "Novedades de Gelpy" notifications | Gelpies and Gelpers | App, Android |
| Read the public pages and the privacy, cookies, and terms pages | Anyone | Website |
| Send a push notification and follow its delivery | The team | Admin console |

Inside the app, Inicio and Tareas show that these sections are being built. The marketplace itself, where a Gelpie finds and books a Gelper, is not open yet.

## Planned

These capabilities are not in production yet:

- **Account rules:** sign-up by invitation only, a maintenance pause of the app's sign-in, account deactivation by the team, accepting a new major version of the legal texts again, linking Google from Perfil, and adding the other account type from Perfil.
- **More sign-in options:** passkeys on Android, and account deletion.
- **Notifications:** the consent recorded with the version of its text, a repeated send that goes out only once, and notices about bookings.
- **Admin console:** roles and permissions, app accounts, sign-up invitations, platform settings, and categories.
- **The complaints book**, the Libro de Reclamaciones that Peruvian law requires.
- **The marketplace pilot:** Gelper profiles, the directory, client addresses, assisted search, statistics for Gelpers, and later, booking.
- **Measurement** of product use, only with consent.

## In this section

- [Accounts and profile](./accounts.md)
- [Notifications](./notifications.md)
- [Admin console](./console.md)
- [Complaints book (planned)](./complaints-book.md)
- [Marketplace pilot (planned)](./marketplace-pilot.md)

## Related pages

- [Architecture overview](../architecture/overview.md)
- [Identity and sign-in](../security/identity.md)
- [Quality overview](../quality/overview.md)
