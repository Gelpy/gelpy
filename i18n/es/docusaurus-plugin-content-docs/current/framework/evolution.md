---
sidebar_position: 8
title: Origen y evolución
description: De dónde viene el Framework agéntico de Gelpy, qué agregó Gelpy y cómo sigue evolucionando el framework.
---

# Origen y evolución

## Origen

El framework empezó como una copia del AI-Driven Framework que el CTO de Gelpy construyó para un proyecto anterior, Portfolio Tracker ([docs públicos](https://docs.portfolio-tracker.us/)). Gelpy adoptó sus gates el 2026-10-31 y lo ha hecho evolucionar desde entonces.

Portfolio Tracker nunca es una referencia visual ni de producto para Gelpy. Solo se reutilizó el método.

## Qué tenía la base

Según la página pública del framework de la base:

- un flujo de trabajo guiado por IA con archivos locales de Spec Kit;
- un gate de Work Item: un Work Item local, una referencia a un issue de GitHub, una rama `codex/` acotada, un Work Item por PR, evidencia de validación, y actualizaciones del changelog y de la memoria;
- `tasks.md` como fuente del estado, sin sincronización de issues;
- un catálogo de 10 skills: validación del entorno, scaffolding del ecosistema, configuración de infraestructura, inicialización de la API, análisis de requisitos, planificación, seguimiento de Work Items, validación de cumplimiento, actualización de documentación, y release y versionado;
- ADRs, un manifiesto de versiones y docs bilingües;
- subidas de versión en los PRs, con tags creados en CI;
- un solo ejecutor, Codex, con puntos de entrada en cada repo que apuntan al catálogo;
- infraestructura local (Docker) y un servidor local de calidad de código.

## Qué agregó Gelpy

| Dimensión | Base | Gelpy |
|-----------|------|-------|
| Ejecutores | Un ejecutor de IA | Una oficina de startup de 13 agentes en dos áreas, Producto e Ingeniería y Negocio, cada una a cargo de un jefe, en sesiones paralelas en la nube, con Codex como revisor de código de releases |
| Coordinación | — | Un protocolo de mensajes, respuestas `STATUS` y transferencias verificadas entre sesiones |
| Skills | 10 | 23; agrega orchestrate, challenge-request, verify, codex-review, apply-brand, design-web-experience, design-product-experience, produce-motion-video, audit-public-claims, progress-status, business-coach, self-improve y db-table-standards |
| Revisión del dueño | — | Un veredicto estricto por punto en cada pedido y en cada delegación |
| Issues | Solo referencias | Estado reflejado en etiquetas y en el cierre, sub-issues Epic → Feature → Work Item, y milestones |
| Planificación | Work Items | Sprints de 1 semana, puntos y progreso en porcentaje por repo |
| Verificación | Evidencia de validación | Measure, Check y Verified by por criterio, un lint de palabras vagas, y PASS/FAIL/HUMAN PENDING antes de Done |
| Entrega | Infraestructura local y CI | Solo en la nube: Cloudflare Workers Builds, trenes de release `staging`/`main`, despliegues de vista previa con `noindex`, y canales móviles con actualizaciones OTA |
| Revisión | Servidor local de calidad de código | SonarCloud en cada PR, gitleaks, cobertura de 90% y Codex en los PRs de release |
| Diseño | — | Primero el diseño: un Product Designer diseña cada pantalla o flujo nuevo con todos sus estados, el dueño lo aprueba por escrito antes del código, y un paquete versionado de design system |
| Negocio | — | Un área de Negocio a cargo del Gerente de Estrategia, con el Analista Legal, el Growth Marketer, roles a pedido y una memoria de casos |
| Ramas | `codex/` | `claude/` y `codex/` |

## Línea de tiempo

| Fecha | Cambio |
|-------|--------|
| 2026-10-31 | Gelpy adopta los gates del framework base |
| 2026-11-08 | La versión 1.0 se documenta en este sitio |
| 2026-11-09 | Los agentes se organizan como una oficina de startup: dos jefes, cargos de oficina, equipos sin jefe y un Product Designer |

## Lecciones aprendidas

1. **Los builds de vista previa nunca tienen tokens de deploy.** Cualquier rama puede correr código en un build de vista previa, así que un token ahí podría publicar en producción. Las vistas previas de PR se publican a pedido.
2. **Verificar el árbol en cada transferencia.** Un manifiesto de checksums más el hash del árbol de git hacen exacta la entrega entre sesiones.
3. **Leer la evidencia, no el reporte.** El Technical Product Manager audita diffs, logs y respuestas en vivo antes de hacer merge o de reportar.
4. **Las líneas de estado envejecen.** Antes de reportar avances, se revisa cada Work Item contra git, los Releases y los controles en vivo. Una revisión del 2026-11-08 encontró 2 ítems ya terminados.
5. **Un PR en curso por repo** evita conflictos y hace auditable cada merge.
6. **El diseño aprobado antes del código** evita rehacer pantallas.

## Cómo sigue evolucionando

- Las retrospectivas de `gelpy-self-improve` pueden cambiar una regla.
- Las decisiones duraderas se vuelven ADRs o enmiendas de ADRs.
- Cada cambio del framework actualiza esta sección en el mismo ciclo (`gelpy-update-docs`).

## Páginas relacionadas

- [Framework agéntico de Gelpy](./overview.md)
- [Skills](./skills.md)
- [Reglas del dueño y seguridad](./rules.md)
