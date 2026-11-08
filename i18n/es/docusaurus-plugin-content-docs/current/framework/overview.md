---
sidebar_position: 1
title: Framework agéntico de Gelpy
description: El método de trabajo que construye Gelpy, donde un dueño humano dirige un equipo de agentes de IA especializados.
---

# Framework agéntico de Gelpy

El Framework agéntico de Gelpy es el método de trabajo que construye Gelpy. Un dueño humano dirige un equipo de agentes de IA especializados. Los agentes planifican, construyen, revisan, publican y documentan el producto, y asesoran sobre el negocio. El dueño decide; los agentes recomiendan, ejecutan y demuestran.

:::note Estado

En uso desde 2026-10-31. Versión 1.0 documentada el 2026-11-08.

:::

## Principios

Cada principio viene de una regla que siguen los agentes.

1. **El dueño decide.** Los agentes dan un veredicto por punto en cada pedido, y el dueño elige (`gelpy-challenge-request`).
2. **Primero la spec.** Ningún cambio importante empieza sin un Work Item con criterios de aceptación SMART y un issue de GitHub (ADR-0003).
3. **Primero el diseño.** Ninguna pantalla ni página se programa antes de que el dueño apruebe su diseño por escrito.
4. **Evidencia antes de Done.** Cada criterio se verifica y se registra como PASS, FAIL o HUMAN PENDING antes de que un Work Item pase a Done (`gelpy-verify-work-item`).
5. **Test antes de producción.** El trabajo llega primero a `staging` y al entorno de test. Los releases a producción necesitan la aprobación explícita del dueño (ADR-0005).
6. **Secretos nunca en el código ni en el chat.** Los inventarios guardan solo nombres, y los agentes nunca ven los valores.
7. **Un dueño por repo.** Cada repo tiene un agente especializado. Los agentes nunca editan otro repo; lo piden mediante el protocolo.
8. **Memoria bilingüe.** El inglés es el canónico y el español es el acompañante. El dueño trabaja en español (ADR-0007).

## Mapa del sistema

```mermaid
flowchart LR
  owner([Dueño])
  master[Master Agent]
  coach[Business Coach]
  infra[Agent Infra]
  codex[Codex<br/>segundo ejecutor y<br/>revisor de PRs de release]

  subgraph repos[Agentes de repo]
    api[Agent API]
    db[Agent DB]
    app[Agent App]
    web[Agent Web]
    console[Agent Console]
    design[Agent Design]
    docs[Agent Docs]
  end

  subgraph team[Equipo de negocio]
    legal[Legal Peru]
    marketing[Marketing]
    temp[Especialistas temporales]
  end

  owner <--> master
  owner <--> coach
  master --> infra
  master --> repos
  master -.-> codex
  coach --> team
  coach -->|REQUEST_CHANGE| master
```

El Master Agent coordina la ingeniería. El Business Coach coordina la asesoría de negocio y envía las necesidades de ingeniería al Master como un `REQUEST_CHANGE`.

## Dónde vive

La fuente de verdad es el repo privado `gelpy-architecture`. Contiene:

- el gate `AGENTS.md`;
- los perfiles de los agentes en `.claude/agents/`;
- las skills en `codex/skills/`;
- las specs y los Work Items en `specs/`;
- los ADRs en `adr/`;
- los scripts de gobierno y `PROJECT_STATE.md`.

Cada repo de producto tiene su propio gate `AGENTS.md`, un perfil de agente y un router `codex/` hacia las skills centrales. Este sitio explica el método; no reemplaza esos archivos.

## En números (v1.0)

| Elemento | Cantidad |
|----------|----------|
| Perfiles de agente | 12, más especialistas temporales, más Codex |
| Skills | 21 |
| ADRs | 18 |
| Specs | 11 |
| Work Items en la Fase 1 | Unos 170 |
| Repos | 8 |

## Glosario

| Término | Significado |
|---------|-------------|
| Work Item | La unidad de trabajo más pequeña que se sigue: un PR en un repo |
| AC | Un criterio de aceptación |
| Gate | Un control que debe pasar antes del siguiente paso |
| Tren de release | Releases coordinados de `staging` → `main` en varios repos |
| Actualización OTA | Una actualización de JavaScript que llega a las apps instaladas sin un build de tienda |
| Handoff | El documento que inicia y registra una corrida larga de trabajo |
| Veredicto | La revisión ✅/⚠️/❌ de un pedido |

## Páginas relacionadas

- [El equipo de agentes](./agents.md)
- [Skills](./skills.md)
- [Work Items y sprints](./work-items.md)
- [Entrega: gates, entornos y releases](./delivery.md)
- [Reglas del dueño y seguridad](./rules.md)
- [Business Coach](./business-coach.md)
- [Origen y evolución](./evolution.md)
