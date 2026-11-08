---
slug: /
sidebar_position: 1
title: Introducción
---

# Ingeniería de Gelpy

Gelpy conecta a profesionales de servicios generales con personas que necesitan ayuda, con seguridad y confianza.

Este sitio reúne la documentación pública de ingeniería de Gelpy. Cubre la arquitectura de alto nivel, el flujo de datos, la postura de seguridad y el método de ingeniería. La Fase 1 construye solo la base de la aplicación.

## Empieza aquí

- [Visión general de la arquitectura](./architecture/overview.md): componentes, plataforma, entornos y flujo de release.
- [Flujo de datos](./architecture/data-flow.md): cómo se mueven las peticiones y los datos en el sistema.
- [Base de la app](./architecture/app-shell.md): navegación, onboarding, idiomas y temas de la app.
- [Visión general de seguridad](./security/overview.md): postura de seguridad y reglas de manejo de datos.
- [Identidad e inicio de sesión](./security/identity.md): registro, inicio de sesión, la consola de admins y los datos de identidad.
- [Framework agéntico](./framework/overview.md): el método de trabajo que construye Gelpy, con un dueño humano y un equipo de agentes de IA.
- [Reglas de documentación](./contributing/documentation-rules.md): cómo crecen estos docs y qué se puede publicar.

## Cómo funciona este sitio

- La carpeta `docs/` del repositorio [Gelpy/gelpy](https://github.com/Gelpy/gelpy) es la fuente.
- El inglés es el idioma por defecto. Las páginas en español viven en `i18n/es`.
- Cada merge a `main` construye y publica el sitio, y refleja estas páginas en la wiki del repositorio. El build falla ante cualquier enlace roto.

## ¿Quién está a cargo?

**Edgardo Gutierrez**, Cofundador, CTO y Forward Deployed Engineer (FDE). Lidera la ingeniería de Gelpy.

Sitio web: [edgardo-gutierrez.com](https://edgardo-gutierrez.com)

Gelpy es un producto de Analytic's & Code Associates S.A.C.
