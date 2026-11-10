---
sidebar_position: 6
title: Reglas del dueño y seguridad
description: Qué aprueba siempre el dueño, cuándo se detienen los agentes, cómo se manejan los secretos y los ADRs detrás del framework.
---

# Reglas del dueño y seguridad

## Veredicto por punto

Cada pedido del dueño recibe un veredicto experto y estricto por punto, cada uno con su razón:

- ✅ aceptar tal cual;
- ⚠️ aceptar con ajustes;
- ❌ rechazar.

El dueño decide. Los agentes de repo aplican la misma revisión a cada `DELEGATE`.

## Reglas de la organización

La organización de startup del 2026-11-09 (una enmienda al ADR-0008) agrega estas reglas.

1. **Cada jefe reporta solo al dueño.** Ningún jefe aprueba el trabajo del otro ni cambia sus prioridades.
2. **El trabajo viene del jefe.** Un especialista o agente de repo toma trabajo solo de su jefe. El trabajo entre las áreas va de jefe a jefe: el Gerente de Estrategia envía un `REQUEST_CHANGE` al Technical Product Manager, y el Technical Product Manager envía un `REQUEST_REVIEW` o un `REQUEST_INFO` al Gerente de Estrategia en lugar de llamar él mismo a Legal o a Marketing.
3. **Los conflictos van al dueño.** Un conflicto de prioridad, alcance o presupuesto entre las áreas lo decide el dueño. Cada jefe presenta su posición como una revisión crítica con un veredicto por punto.
4. **La información de campo se registra.** Lo que el dueño trae del campo (profesionales, clientes, el piloto) se registra como información aportada por el dueño, con su fecha.
5. **Los equipos no agregan una capa.** Los equipos no tienen jefe. El Technical Product Manager delega directamente en cada agente de repo.
6. **El Product Designer diseña antes del código.** Cada pantalla o flujo nuevo se diseña en el canvas de diseño, con todos sus estados (vacío, cargando, error, éxito, retomar, función apagada, sin permiso, sin conexión), en claro y oscuro, en español e inglés, antes de cualquier código. El Product Designer no cambia tokens (lo hace el Ingeniero de Design Systems), no aprueba nada (lo hace el dueño) y no escribe código de producto. Un cambio visual pequeño queda en manos del agente de repo, que actualiza el canvas en el mismo PR.

## Qué aprueba siempre el dueño

- El diseño de cada pantalla y página, por escrito, antes del código.
- Cada merge a `main` en un repo desplegable, lo que significa producción.
- Los gastos: builds nativos, servicios pagados, créditos de voz IA.
- Debilitar un criterio de aceptación.
- Todo lo que toque datos personales.
- Cada veredicto ⚠️ o ❌.

## Condiciones de parada

Un agente se detiene y consulta al dueño cuando:

- falla un gate;
- hay que gastar dinero;
- se tocaría producción fuera de un release aprobado;
- habría que debilitar un criterio;
- aparecen secretos o datos personales.

## Cómo se trabaja con el dueño

- En español.
- Una acción del dueño por mensaje, y pocos mensajes.
- Un plan antes de ejecutar, que el dueño aprueba.
- Tareas programadas para las acciones atadas a una hora.
- Los tableros de diseño siempre están al día: un cambio visible actualiza su tablero en el mismo PR.
- **Primero la autonomía.** Antes de pedirle algo al dueño, un agente revisa si sus propias herramientas y su acceso de solo lectura pueden hacerlo. Si no pueden, pide el acceso mínimo. El dueño lo ingresa en un formulario seguro o en el panel del proveedor, nunca en el chat.

## Política de secretos

- Los secretos nunca van en el código, el chat, los logs, los issues ni los docs.
- Los inventarios listan solo nombres de secretos, nunca valores.
- Los secretos de runtime se configuran por Worker.
- Las credenciales de deploy viven solo en la configuración de los builds de producción, ingresadas por el dueño.
- Los builds de PR y de vista previa nunca reciben tokens de deploy.
- Los agentes nunca ven los valores de los secretos.
- Las credenciales de solo lectura del Technical Product Manager las inyecta el proxy de red de la plataforma; nunca se pegan.
- Un secreto encontrado en cualquier lugar detiene el trabajo.

## Qué nunca publica este sitio

- Secretos
- Hosts internos
- Datos personales
- Vulnerabilidades abiertas
- Manuales de marca o archivos editables

Consulta las [Reglas de documentación](../contributing/documentation-rules.md) para ver la lista completa y el control que la aplica.

## ADRs

| ADR | Título |
|-----|--------|
| 0001 | Record architecture decisions |
| 0002 | Repository ecosystem and framework exceptions |
| 0003 | Backlog traceability and SMART acceptance criteria |
| 0004 | Release and versioning |
| 0005 | Environments and branching |
| 0006 | Cloudflare cloud platform |
| 0007 | Documentation language strategy |
| 0008 | Agent orchestration governance (amended: startup organization) |
| 0009 | Database schema source of truth |
| 0010 | Brand and design system |
| 0011 | Quality and security gates |
| 0012 | Automatic Codex review (amended: release PRs only) |
| 0013 | Website stack: Nuxt SSG, web motion, and HyperFrames media |
| 0014 | Migration credentials in GitHub Environments |
| 0015 | Coverage gate: 90% minimum, 95% target |
| 0016 | API connects to Postgres through the provider pooler, without Hyperdrive |
| 0017 | CI/CD pipeline policy: validate once, deploy on merge, no deploy secrets in PRs |
| 0018 | CI/CD on Cloudflare Workers Builds |

Los títulos de los ADRs se mantienen en inglés, que es su idioma canónico.

## Páginas relacionadas

- [Framework agéntico de Gelpy](./overview.md)
- [Entrega: gates, entornos y releases](./delivery.md)
- [Visión general de seguridad](../security/overview.md)
- [Reglas de documentación](../contributing/documentation-rules.md)
- [El equipo de agentes](./agents.md)
