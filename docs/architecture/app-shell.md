---
sidebar_position: 3
title: App shell
description: "How the Gelpy app is organized: navigation, onboarding, languages, themes, and screen sizes."
---

# App shell

The app shell is the base of the Gelpy app. It holds navigation, first-launch onboarding, the language and theme settings, and the layout for phones and browsers. Later features, such as sign-in and requests, are built inside it.

:::note Status

The app shell is in development and runs only in the test environment. It is not in production yet. This page describes how it works today; it will be updated when the shell reaches production.

:::

The same app runs on Android and in the browser.

## Navigation

The app has three main tabs, in this order:

| Tab | Spanish label | Today |
|-----|---------------|-------|
| Home | Inicio | The starting screen. Its content arrives with later features. |
| Tasks | Tareas | Reserved for later features. |
| Profile | Perfil | The language and theme settings. |

The tabs stay at the bottom of the screen on Android and in the browser. On the web, each tab has its own address, so links and the browser's back button work.

## Onboarding

```mermaid
flowchart LR
  first([First launch]) --> onboarding[Onboarding screens]
  onboarding --> done[Finished or skipped,<br/>saved on the device]
  done --> tabs[Main tabs]
  later([Later launches]) --> tabs
```

- On first launch, the app shows a short set of onboarding screens before the tabs.
- People can skip onboarding at any time.
- Once onboarding is finished or skipped, the app remembers it on the device and goes straight to the tabs from then on.
- One screen asks whether to turn on notifications. People can say "Not now", and onboarding does not ask again.

## Languages

- The app is available in Spanish and English. Spanish is the default.
- People change the language in Profile. All visible text changes at once, without restarting the app.
- The choice is saved on the device and kept the next time the app opens.
- Every text exists in both languages, and tests check that none is missing.
- On the web, the page language is updated too, so screen readers and translation tools read it correctly.

## Themes

- People choose between three options in Profile: **System**, **Light**, and **Dark**.
- **System** is the default and follows the device setting.
- The choice is saved on the device and kept across restarts.
- Colors, type, and spacing come from the Gelpy design system. Dark mode uses deep navy surfaces.
- Text meets WCAG AA contrast in light and dark. An automated accessibility test checks it.

## Screen sizes

The web app adapts to phones, tablets, and desktops. Tests check widths of 375, 768, and 1440 pixels, and no screen scrolls sideways at any of them.

## Local preferences

Language, theme, and onboarding progress are stored only on the device, as local preferences. They contain no personal data. Sign-in credentials will never be stored with them.

## Related pages

- [Architecture overview](./overview.md)
- [Data flow](./data-flow.md)
