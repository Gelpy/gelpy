---
sidebar_position: 1
title: Qué hace Gelpy hoy
description: Lo que las personas pueden hacer con Gelpy hoy en producción, y lo que está previsto.
---

# Qué hace Gelpy hoy

Gelpy conecta a profesionales de servicios generales con personas que necesitan ayuda en casa, con seguridad y confianza. Esta sección describe el producto desde el punto de vista de quienes lo usan: qué pueden hacer, quién puede hacerlo y si ya funciona.

:::note Estado

Estado al 2026-11-15. Solo lo que funciona en producción se describe como disponible. Todo lo demás figura como previsto, y esta sección cambia cuando llega a producción.

:::

## Palabras que se usan aquí

| Palabra | Significado |
|---------|-------------|
| Gelpie | Una persona que necesita ayuda: el cliente |
| Gelper | Un profesional que ofrece un servicio |
| Equipo | El personal de Gelpy que opera la plataforma desde la consola de administración |

## Dónde funciona Gelpy

| Superficie | Quién la usa | En producción |
|------------|--------------|---------------|
| La app Gelpy en la web | Gelpies y Gelpers | La base de la app desde el 2026-11-03; las cuentas y el inicio de sesión desde el 2026-11-07; la versión 0.5.0 de la app desde el 2026-11-15 |
| La app Gelpy en Android | Gelpies y Gelpers | Desde el primer build de producción del 2026-11-08, instalado como APK; la app no está en Google Play. Los cambios de la app del 2026-11-15 llegan a Android con su próximo build |
| El sitio web | Cualquier persona | Desde el 2026-11-08, con sus páginas legales; el Libro de Reclamaciones desde el 2026-11-15 |
| La consola de administración | El equipo de Gelpy | Desde el 2026-11-07; los módulos de acceso, cuentas de la app, invitaciones, configuración de la plataforma, Libro de Reclamaciones y catálogo desde el 2026-11-15 |

## Lo que se puede hacer hoy

En la app:

| Qué | Dónde |
|-----|-------|
| Crear una cuenta con una invitación del equipo de Gelpy: con correo y contraseña, confirmada con un link por correo, o con Google, como Gelpie, Gelper o ambos | Web |
| Iniciar sesión con correo y contraseña o con Google | Web y Android |
| Iniciar sesión con una passkey, y crear, ver y revocar passkeys | Web |
| Agregar un número de teléfono y verificarlo por SMS | Web y Android |
| Vincular Google a la cuenta desde Perfil | Web |
| Desbloquear la app con la huella o el rostro | Android |
| Encender las notificaciones "Novedades de Gelpy" | Android |

En el sitio web, cualquier persona puede leer las páginas públicas y las páginas de privacidad, cookies y términos, y presentar un reclamo en el [Libro de Reclamaciones](./complaints-book.md) sin una cuenta. El sitio web mide su propio uso con Google Analytics y Microsoft Clarity solo si la persona lo permite, en "Preferencias de cookies".

En la consola de administración, el equipo de Gelpy envía notificaciones push, administra las cuentas de la app y las invitaciones de registro, responde el Libro de Reclamaciones y mantiene el catálogo que usará el piloto del marketplace. Ver [Consola de administración](./console.md).

Dentro de la app, Inicio y Tareas muestran que esas secciones se están construyendo. El marketplace, donde un Gelpie encuentra y reserva a un Gelper, todavía no está abierto.

## Previsto

Estas capacidades todavía no están en producción:

- **La app en Android:** los cambios de la app del 2026-11-15, como la pantalla de mantenimiento, aceptar una nueva versión de los textos legales, vincular Google y los enlaces al Libro de Reclamaciones, llegan con su próximo build.
- **Reglas de cuenta:** agregar el otro tipo de cuenta desde Perfil.
- **Más opciones de acceso:** recuperar la contraseña, passkeys en Android y la eliminación de la cuenta.
- **Notificaciones:** un envío repetido que sale una sola vez y avisos sobre las reservas.
- **El piloto del marketplace:** perfiles de Gelper, el directorio, las direcciones de los clientes, la búsqueda asistida, estadísticas para los Gelpers y, más adelante, las reservas.
- **La analítica de uso** de la app con Google Analytics y Microsoft Clarity, que solo se enciende con el permiso de la persona. Otros datos técnicos y de funcionamiento se tratan sin ese permiso, como explica la [política de privacidad](https://gelpy.app/privacidad/).

## En esta sección

- [Cuentas y perfil](./accounts.md)
- [Notificaciones](./notifications.md)
- [Consola de administración](./console.md)
- [Libro de Reclamaciones](./complaints-book.md)
- [Piloto del marketplace (previsto)](./marketplace-pilot.md)

## Páginas relacionadas

- [Visión general de la arquitectura](../architecture/overview.md)
- [Identidad e inicio de sesión](../security/identity.md)
- [Visión general de la calidad](../quality/overview.md)
