---
sidebar_position: 1
title: Reglas de documentación
description: Cómo crecen estos docs con cada función y qué se puede publicar.
---

# Reglas de documentación

## Regla de cierre

Cada spec de producto termina con un Work Item de documentación en este repositorio. Ese Work Item actualiza estos docs cuando la función llega a producción, en el mismo tren de release.

- Una función se documenta como disponible solo cuando llega a producción. Hasta entonces, estos docs la llaman prevista.
- Cada cambio actualiza la página en inglés de `docs/` y su página en español de `i18n/es/` en el mismo pull request.
- Los comandos, rutas, nombres de archivo y claves de configuración no se traducen.

## Qué se puede publicar

Se publica:

- Diagramas de arquitectura y de flujo de datos de alto nivel
- La postura de seguridad y las reglas de manejo de datos
- Los límites del producto y el roadmap público

Nunca se publica:

- Secretos, tokens, claves ni cadenas de conexión
- Hosts internos, entornos de test ni direcciones IP
- Datos personales, incluidos emails y teléfonos
- Vulnerabilidades abiertas o sin resolver
- Archivos del manual de marca, archivos de diseño editables ni fuentes

## Control de seguridad pública

`npm run check:public` revisa todo lo que publica el sitio: `docs/`, `i18n/`, `docusaurus.config.js`, `sidebars.js` y `static/`. Falla si encuentra:

- Secretos, como claves privadas, tokens de acceso, API keys o credenciales dentro de URLs
- Hosts internos, entornos de test o direcciones IP
- Enlaces a hosts fuera de la lista pública permitida
- Emails o teléfonos
- Términos de proyectos privados de referencia

El control corre en CI en cada pull request y en cada push a `main`. Los reportes ocultan casi todo el texto encontrado, para que los logs nunca repitan un secreto.

## Reglas de build

- `npm run build` compila inglés y español y falla ante cualquier enlace roto.
- Usa Node 22 (`.nvmrc`) e instala con `npm ci`.
