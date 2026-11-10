---
sidebar_position: 2
title: Flujo de datos
description: Cómo se mueven las peticiones y los datos en Gelpy, desde la app hasta la base de datos.
---

# Flujo de datos

Esta página muestra cómo se mueven los datos en el sistema de la Fase 1 que funciona hoy.

## Recorrido de una petición

```mermaid
sequenceDiagram
  autonumber
  participant C as App o consola
  participant W as Worker
  participant A as Contenedor de la API
  participant D as PostgreSQL

  C->>W: Petición HTTPS con token de acceso
  W->>A: Reenvía la petición
  A->>A: Valida la entrada y el token
  A->>D: Consulta
  D-->>A: Filas
  A-->>W: Respuesta JSON
  W-->>C: Respuesta HTTPS
```

- Todo el tráfico usa HTTPS.
- La API valida la entrada de cada petición con esquemas (Zod) antes de usarla.

## Inicio de sesión

Las personas se registran con correo y contraseña, confirmados con un link por correo, o con Google. El teléfono se agrega después y se verifica por SMS. Las sesiones usan tokens de refresco de un solo uso. Consulta [Identidad e inicio de sesión](../security/identity.md) para ver los flujos, su estado y cómo se manejan los datos de identidad.

## Notificaciones

Las notificaciones push están en producción desde el 2026-11-08. En Android, cada persona decide si las recibe. La app registra el dispositivo en la API, la API envía cada notificación por un relay de push y un servicio push, y registra cada entrega para no enviar la misma notificación dos veces. Consulta [Notificaciones push](./push.md).

## Datos en reposo

- La base de datos es la fuente de verdad.
- Los datos personales se limitan a lo que el producto necesita:
  - Nombre, correo, teléfono y la foto del perfil de Google
  - El token push de cada instalación de Android, con sus preferencias de notificación y sus registros de entrega
  - Las claves públicas de las passkeys
  - El registro de aceptación de los textos legales, con las versiones de los textos
- Los datos de test nunca vienen de producción.

## Páginas relacionadas

- [Visión general de la arquitectura](./overview.md)
- [Notificaciones push](./push.md)
- [Visión general de seguridad](../security/overview.md)
