---
sidebar_position: 1
title: Visión general de seguridad
description: Postura de seguridad de Gelpy, reglas de manejo de datos y controles de calidad.
---

# Visión general de seguridad

Gelpy maneja cuentas y datos personales, así que la seguridad forma parte de cada cambio desde el inicio. Esta página describe la postura y las reglas que siguen todos los repositorios. No lista vulnerabilidades abiertas, hosts internos ni secretos.

:::note Estado

La Fase 1 está en desarrollo. Las reglas de esta página ya se aplican en todos los repositorios de Gelpy. Las capacidades del producto marcadas como previstas todavía no están en funcionamiento.

:::

## Marcos de referencia

El diseño de Gelpy sigue estos marcos:

- OWASP Top 10
- La Ley 29733 de Protección de Datos Personales del Perú
- Los principios del GDPR
- Las prácticas de SOC 2

Estos marcos guían el diseño. No son una certificación.

## Clasificación de datos

| Clase | Ejemplos | Manejo |
|-------|----------|--------|
| Pública | Docs de ingeniería, páginas del sitio web | Se publica tras un control de seguridad pública |
| Datos personales | Nombre, email, teléfono | Se recogen solo cuando hacen falta y se guardan solo en la base de datos de producción |
| Credenciales | Hashes de contraseñas, passkeys, tokens | Nunca se registran en logs, nunca los devuelve la API y nunca aparecen en los docs |
| Secretos | API keys, claves de firma, cadenas de conexión | Se guardan en el almacén de secretos de la plataforma, nunca en el código |

## Autenticación (prevista)

- Inicio de sesión con Google, o con email y contraseña más un código de un solo uso.
- Desbloqueo biométrico opcional en Android y passkeys verificadas por el servidor en Android y web. Cada persona puede revocarlas.
- Las contraseñas y los códigos de un solo uso se guardan solo como hashes.
- Los tokens de refresco rotan en cada uso y dejan de funcionar al cerrar sesión.

## Manejo de secretos

- Los secretos de ejecución van en el almacén de secretos de Cloudflare, por Worker y por entorno.
- GitHub guarda solo credenciales de despliegue: tokens de despliegue y, para las migraciones de esquema, una credencial de base de datos exclusiva para migraciones, en entornos protegidos.
- Los secretos nunca van en el código, los docs, los logs ni los fixtures de pruebas.

## Regla de logs

Los logs nunca registran contraseñas, códigos de un solo uso, tokens ni datos personales.

## Aislamiento de entornos

Test y producción están separados. Cada uno tiene su propia base de datos, secretos, clientes OAuth y configuración de passkeys. Los datos personales de producción nunca pasan a test.

## Controles de calidad y seguridad

Cada pull request debe pasar:

- Lint y chequeo de tipos
- Pruebas con al menos 90% de cobertura, con una meta de 95%
- Un build exitoso
- `npm audit`
- Revisión de código
- Controles de accesibilidad y de marca en los repositorios visuales

## Regla de documentación pública

Este sitio publica solo arquitectura de alto nivel, flujo de datos y postura de seguridad. Antes de publicar, `npm run check:public` revisa el contenido del sitio y falla si encuentra secretos, hosts internos, direcciones IP o datos personales. Consulta las [Reglas de documentación](../contributing/documentation-rules.md).

## Reportar una vulnerabilidad

No reportes una posible vulnerabilidad en un issue, pull request o discusión pública. Aquí se publicará un canal privado para reportarlas.

## Páginas relacionadas

- [Visión general de la arquitectura](../architecture/overview.md)
- [Flujo de datos](../architecture/data-flow.md)
