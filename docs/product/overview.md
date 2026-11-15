---
sidebar_position: 1
title: What Gelpy does today
description: What people can do with Gelpy in production today, and what is planned.
---

# What Gelpy does today

Gelpy connects general-services professionals with people who need help at home, with safety and trust. This section describes the product from the point of view of the people who use it: what they can do, who can do it, and whether it is live.

:::note Status

State on 2026-11-15. Only what runs in production is described as available. Everything else is marked as planned, and this section changes when it reaches production.

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
| The Gelpy app on the web | Gelpies and Gelpers | The app shell since 2026-11-03; accounts and sign-in since 2026-11-07; app release 0.5.0 since 2026-11-15 |
| The Gelpy app on Android | Gelpies and Gelpers | Since the first production build of 2026-11-08, installed as an APK; the app is not on Google Play. The app changes of 2026-11-15 reach Android with its next build |
| The website | Anyone | Since 2026-11-08, with its legal pages; the complaints book since 2026-11-15 |
| The admin console | The Gelpy team | Since 2026-11-07; the modules for access, app accounts, invitations, platform settings, the complaints book, and the catalog since 2026-11-15 |

## What people can do today

In the app:

| What | Where |
|------|-------|
| Create an account with an invitation from the Gelpy team: with email and password, confirmed by an email link, or with Google, as a Gelpie, a Gelper, or both | Web |
| Sign in with email and password or with Google | Web and Android |
| Sign in with a passkey, and create, list, and revoke passkeys | Web |
| Add a phone number and verify it by SMS | Web and Android |
| Link Google to the account from Perfil | Web |
| Unlock the app with a fingerprint or the face | Android |
| Turn on the "Novedades de Gelpy" notifications | Android |

On the website, anyone can read the public pages and the privacy, cookies, and terms pages, and file a claim in the [complaints book](./complaints-book.md) without an account. The website measures its own use with Google Analytics and Microsoft Clarity only if the person allows it, in "Cookie preferences".

In the admin console, the Gelpy team sends push notifications, manages app accounts and sign-up invitations, answers the complaints book, and keeps the catalog that the marketplace pilot will use. See [Admin console](./console.md).

Inside the app, Inicio and Tareas show that these sections are being built. The marketplace itself, where a Gelpie finds and books a Gelper, is not open yet.

## Planned

These capabilities are not in production yet:

- **The Android app:** the app changes of 2026-11-15, such as the maintenance screen, accepting a new version of the legal texts, linking Google, and the links to the complaints book, come with its next build.
- **Account rules:** adding the other account type from Perfil.
- **More sign-in options:** password recovery, account deletion, and passkeys on Android, which the app offers but which are pending verification on a phone.
- **Notifications:** a repeated send that goes out only once, and notices about bookings.
- **The marketplace pilot:** Gelper profiles, the directory, client addresses, assisted search, statistics for Gelpers, and later, booking.
- **Usage analytics** of the app with Google Analytics and Microsoft Clarity, which turn on only with the person's permission. Other technical and operating data are handled without that permission, as the [privacy policy](https://gelpy.app/en/privacy/) explains.

## In this section

- [Accounts and profile](./accounts.md)
- [Notifications](./notifications.md)
- [Admin console](./console.md)
- [Complaints book](./complaints-book.md)
- [Marketplace pilot (planned)](./marketplace-pilot.md)

## Related pages

- [Architecture overview](../architecture/overview.md)
- [Identity and sign-in](../security/identity.md)
- [Quality overview](../quality/overview.md)
