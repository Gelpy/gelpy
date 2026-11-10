---
sidebar_position: 3
title: Desbloqueo con huella y passkeys
description: "Cómo funcionan en Gelpy el desbloqueo con huella en Android y las passkeys, dónde está disponible cada uno y qué nunca se guarda."
---

# Desbloqueo con huella y passkeys

Esta página describe dos formas de entrar a Gelpy sin escribir una contraseña: el desbloqueo con huella en Android y las passkeys. Describe flujos, no pantallas, y deja fuera los detalles de implementación que podrían ayudar a un atacante.

:::note Estado

Las passkeys están disponibles en la web desde el 2026-11-07. El desbloqueo con huella está en el build de producción de Android desde el 2026-11-08; ese build se instala como APK, y la app no está en Google Play. Las passkeys en Android y el vínculo más fuerte de la sesión que se describe abajo están previstos.

:::

| Capacidad | Estado |
|-----------|--------|
| Passkeys en la web | Disponibles desde el 2026-11-07 |
| Desbloqueo con huella en Android | En el build de producción de Android desde el 2026-11-08 |
| Passkeys en Android | Previsto: necesitan el archivo Digital Asset Links publicado en `gelpy.app` |
| Sesión guardada atada a la verificación de la huella | Previsto: en test, a producción con el próximo release de la app |
| Contador de la passkey protegido | Previsto: en test |
| iOS | Previsto, postergado |

En los dos casos siguen disponibles, como alternativa, el inicio de sesión con Google y el correo con contraseña.

## Desbloqueo con huella (Android)

```mermaid
flowchart LR
  start([La app arranca]) --> saved{¿Hay sesión guardada<br/>y desbloqueo activo?}
  saved -- no --> normal[Arranque normal]
  saved -- sí --> prompt[Pide la huella]
  prompt -- pasa --> open[Se restaura la sesión]
  prompt -- se cancela --> clear[Se borra la sesión guardada]
  clear --> signin[Iniciar sesión otra vez]
```

- El desbloqueo con huella se activa por decisión propia y viene apagado.
- Protege la restauración de la sesión guardada cuando la app arranca: la app pide la huella primero.
- Solo se aceptan biometrías fuertes.
- Si se cancela, la sesión guardada se borra y hay que iniciar sesión otra vez.
- Los datos biométricos se quedan en el dispositivo. Gelpy nunca los recibe.
- No existe en la web.

### Previsto: un vínculo más fuerte

Estos cambios corren en test y llegan a producción con el próximo release de la app, como una actualización over-the-air:

- Si la app no puede leer la preferencia biométrica, la trata como desconocida y no abre ninguna sesión hasta que la verificación pase o la persona inicie sesión otra vez. La app siempre termina en un estado definido.
- La sesión guardada queda atada a la verificación de la huella con una clave sobre (envelope key): una clave aleatoria que se guarda una sola vez en el almacenamiento seguro del dispositivo y que solo se puede leer después de una verificación biométrica exitosa. La sesión se guarda cifrada con esa clave.
- La clave queda en memoria solo mientras la app está desbloqueada. Hay un solo aviso de huella por arranque.
- Si la verificación falla o se cancela, no queda ninguna sesión.
- Registrar una huella nueva hace ilegible la sesión guardada, así que hay que iniciar sesión otra vez.
- Las sesiones guardadas a la manera anterior pasan al almacenamiento nuevo en su siguiente desbloqueo.

## Passkeys

```mermaid
sequenceDiagram
  autonumber
  participant U as Persona
  participant D as Dispositivo
  participant C as App
  participant A as API

  U->>C: "Usar una passkey"
  C->>A: Pide un desafío
  A-->>C: Desafío de un solo uso
  C->>D: Firma el desafío
  D->>U: Verificación del dispositivo
  D-->>C: Respuesta firmada
  C->>A: Verifica
  A->>A: Origen, desafío y clave pública
  A-->>C: Sesión
```

- Las passkeys siguen el estándar WebAuthn. El servidor las registra, las verifica y las revoca.
- Cada entorno tiene su propio relying party. El de producción es `gelpy.app`, y un relying party de test nunca es válido en producción.
- Se entra con "Usar una passkey" en la pantalla de inicio de sesión.
- Una sección Passkeys en Perfil › Cuenta permite crear, listar y revocar las passkeys propias.
- Cada desafío vence y sirve una sola vez. Solo se aceptan los orígenes configurados del entorno.
- El dispositivo guarda la clave privada. La base de datos guarda solo la clave pública.
- Una passkey revocada falla, y el inicio de sesión con Google sigue funcionando.

### Previsto: un contador protegido

En test, el contador de firmas de la passkey sube en un solo paso protegido antes de que exista ninguna sesión, y solo mientras la passkey está activa. Así, una passkey clonada, reutilizada o recién revocada no puede abrir una sesión. La auditoría de un intento fallido guarda solo el motivo.

### Passkeys en Android

Las passkeys en Android están previstas. Necesitan el archivo Digital Asset Links publicado en `gelpy.app`, que vincula la app con el sitio; el build de producción de Android por sí solo no las activa.

## Lo que nunca se guarda

| Gelpy nunca guarda | Por qué |
|--------------------|---------|
| Claves privadas de las passkeys | Se quedan en el dispositivo; la base de datos solo tiene claves públicas |
| Datos biométricos | Se quedan en el dispositivo; Gelpy nunca los recibe |
| Contraseñas en claro | Solo se guardan hashes argon2id |

- Los desafíos son registros de un solo uso que vencen.
- Los logs nunca guardan contraseñas, códigos de un solo uso, tokens ni datos personales.

## Páginas relacionadas

- [Identidad e inicio de sesión](./identity.md)
- [Visión general de seguridad](./overview.md)
- [Base de la app](../architecture/app-shell.md)
