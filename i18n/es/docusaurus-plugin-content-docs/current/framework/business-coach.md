---
sidebar_position: 7
title: Business Coach
description: El asesor del dueño en estrategia de startups en Perú, su equipo de especialistas, sus reglas de evidencia y sus límites.
---

# Business Coach

El Business Coach es el asesor del dueño en estrategia de startups en Perú: validación, economía del marketplace, crecimiento y financiamiento.

## Cómo se activa

El dueño pide "Business Coach" de forma explícita, o el Master le delega una pregunta de negocio. El Master sigue siendo el agente por defecto para el trabajo técnico.

## Equipo

- Legal Peru
- Marketing
- Especialistas temporales, con una disciplina y una pregunta cada uno

Corren como máximo 3 en paralelo. Los especialistas nunca delegan a otros. Las corridas reales de subagentes se registran con sus IDs. Sin herramientas, el Coach dice que la revisión fue secuencial.

## Reglas de evidencia

- Separar hechos, supuestos y vacíos.
- Usar fuentes oficiales y primarias, como la ley peruana del diario oficial y la autoridad de protección de datos.
- Dar alternativas con sus costos.
- Nombrar la siguiente validación: hipótesis, métrica, umbral y plazo.
- Registrar la decisión del dueño.

## Memoria de casos

Cada caso tiene un brief, un análisis y una decisión, en español. La decisión se escribe solo cuando el dueño realmente decidió. Los casos no guardan datos personales.

## Límites

- Un consejo nunca autoriza implementación, gastos, publicación ni producción.
- Un texto legal es un borrador hasta que un abogado lo apruebe por escrito.
- Las necesidades de ingeniería van al Master como un `REQUEST_CHANGE`.

## Un ejemplo real

Legal Peru redactó los textos de privacidad, cookies y términos de Gelpy desde fuentes peruanas primarias. Separó los hechos verificados de las preguntas para un abogado. Los borradores llevan un aviso de "Borrador en revisión" hasta que un abogado los apruebe. Hoy están solo en el entorno de test.

## Flujo

```mermaid
flowchart TB
  question([Pregunta del dueño]) --> verdict[Coach: veredicto por punto]
  verdict --> specialists[Especialistas, en paralelo]
  specialists --> consolidate[El Coach consolida]
  consolidate --> decide{El dueño decide}
  decide --> record[Decisión registrada]
  record -.->|si se necesita ingeniería| change[REQUEST_CHANGE al Master]
```

## Páginas relacionadas

- [Framework agéntico de Gelpy](./overview.md)
- [El equipo de agentes](./agents.md)
- [Reglas del dueño y seguridad](./rules.md)
