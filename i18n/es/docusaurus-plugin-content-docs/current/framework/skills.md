---
sidebar_position: 3
title: Skills
description: Las 21 skills del Framework agéntico de Gelpy, qué hace cada una y cuáles son obligatorias.
---

# Skills

Una skill es un archivo `SKILL.md` con instrucciones empaquetadas para un trabajo repetible. El mismo archivo sirve para Claude Code y para Codex: cada skill tiene además un pequeño archivo de metadatos para Codex. Los repos apuntan al catálogo central en lugar de copiarlo.

## Las 21 skills

| Grupo | Skill | Propósito |
|-------|-------|-----------|
| Gobierno y Work Items | `gelpy-analyze-requirement` | Clasificar un pedido y redactar su spec, en inglés y español |
| | `gelpy-plan-and-decompose` | Convertir una spec en un plan y en Work Items con criterios SMART, issues y sprints |
| | `gelpy-track-work-item` | Estado del Work Item, nombres de rama, higiene de PRs, sincronización de issues |
| | `gelpy-orchestrate-agents` | Registro de agentes y protocolo de mensajes |
| | `gelpy-scaffold-ecosystem` | Archivos base obligatorios para un repo nuevo |
| | `gelpy-update-docs` | Changelog, memoria, ADRs, acompañantes en español y docs públicos después de cada cambio |
| | `gelpy-validate-compliance` | Auditar los repos contra el framework |
| | `gelpy-self-improve` | Retrospectiva sin culpas que puede cambiar una regla |
| Revisión crítica | `gelpy-challenge-request` | Un veredicto estricto por punto en cada pedido del dueño y en cada `DELEGATE`: aceptar, aceptar con ajustes o rechazar. El dueño decide |
| Verificación | `gelpy-verify-work-item` | Ejecutar el control de cada criterio y registrar PASS, FAIL o HUMAN PENDING antes de Done |
| | `gelpy-codex-review` | Revisión de Codex en PRs de release; los hallazgos P0, P1 y de seguridad bloquean el merge |
| | `gelpy-audit-public-claims` | Reglas de evidencia para textos públicos, guiones y borradores legales |
| | `gelpy-validate-environment` | Revisar herramientas y accesos antes de trabajos de configuración o de CI |
| Release | `gelpy-release-version` | Obligatoria al inicio de cada proceso: decisión de versión, changelog, tags, Releases, manifiesto de versiones |
| Marca y diseño | `gelpy-apply-brand` | Checklist de marca para cualquier superficie visual |
| | `gelpy-design-web-experience` | Base de UX, luego tableros de diseño aprobados por el dueño y una spec de motion, todo antes del código |
| | `gelpy-produce-motion-video` | Video HyperFrames con la voz IA del dueño; el guion, el gasto y la vista previa necesitan aprobación cada uno |
| Progreso | `gelpy-progress-status` | Progreso en porcentaje por repo y en total, ponderado por puntos |
| Negocio | `gelpy-business-coach` | Activar el Business Coach y sus especialistas |
| Plataforma | `gelpy-setup-infrastructure` | Trabajo en la plataforma Cloudflare |
| | `gelpy-init-api` | Bases de la API: Clean Architecture y el patrón Result |

## Skills obligatorias

| Skill | Cuándo |
|-------|--------|
| `gelpy-challenge-request` | Cada pedido del dueño y cada `DELEGATE` |
| `gelpy-release-version` | El inicio de cada proceso |
| `gelpy-verify-work-item` | Antes de Done |
| `gelpy-apply-brand` | Cualquier cambio visual |
| `gelpy-codex-review` | PRs de release |
| `gelpy-update-docs` | Después de cada cambio |

## Páginas relacionadas

- [Framework agéntico de Gelpy](./overview.md)
- [El equipo de agentes](./agents.md)
- [Work Items y sprints](./work-items.md)
- [Origen y evolución](./evolution.md)
