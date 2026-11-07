# gelpy

Documentación pública de ingeniería de Gelpy. Este repo es público.

## Estado

El sitio Docusaurus compila en inglés y español. Cloudflare Workers Builds lo construye y el Worker `gelpy-docs` lo sirve en `https://docs.gelpy.app` (ADR-0018). Cada merge a `main` también refleja `docs/` en la wiki de GitHub. La implementación corre desde `gelpy-architecture/handoffs/fase-1-corrida.md`.

## Desarrollo local

Usa Node 22 (`.nvmrc`).

```bash
npm ci
npm start          # Inglés
npm run start:es   # Español
npm run build      # Ambos idiomas; falla ante enlaces rotos
npm run check:public  # Revisión de seguridad pública del contenido publicado
npm run check:brand  # Sin colores ni fuentes fijos, sin archivos de fuentes ni editables
npm test           # Pruebas de los scripts del sitio
npm run ci:local   # Todo el gate local del PR
npm run ci:evidence  # Corre ci:local y escribe ci-evidence.md para el comentario del PR
```

El tema de Gelpy viene del paquete privado `@gelpy/design-system` en GitHub Packages. Si tienes un token que pueda leerlo, expórtalo como `GELPY_PACKAGES_TOKEN` antes de `npm ci`. Sin token, `npm ci` omite el paquete y el sitio se construye con el tema por defecto. Workers Builds exige el tema (`GELPY_REQUIRE_BRAND=1`), así que ahí falla si falta. Nunca subas un token: `.npmrc` solo lo lee del entorno.

`docs/` tiene la fuente en inglés. Las páginas en español viven en `i18n/es/docusaurus-plugin-content-docs/current/`.

## Validación

`npm run ci:local` corre `npm audit`, `npm test`, `npm run check:public`, `npm run check:brand`, el build de la wiki, `npm run build` y un `wrangler deploy --dry-run`. Hasta el 2026-11-30 ("modo MVP") las pruebas corren solo ahí: publica `npm run ci:evidence` como comentario del PR para el SHA de la cabeza.

## Pipeline (Workers Builds)

Un Worker, `gelpy-docs`, conectado a este repo con rama de producción `main` y previews activas. Cada ajuste usa los mismos tres comandos (`scripts/workers-builds.mjs`):

| Comando | Rama de PR | `main` |
|---|---|---|
| `npm run cf:build` | gitleaks sobre los commits del PR y luego el build con `X-Robots-Tag: noindex` | gitleaks sobre los commits empujados (`HEAD^1..HEAD`) y luego el build de producción |
| `npm run cf:preview` | Un despliegue Preview, comentado en el PR | Nada |
| `npm run cf:deploy` | Se niega | Despliegue, chequeo en vivo, GitHub Release `v<versión>` y luego la sincronización de la wiki |

- `GELPY_PACKAGES_TOKEN` (paquetes de solo lectura) es el único secreto de los ajustes de preview.
- `GELPY_RELEASE_TOKEN` y `GELPY_WIKI_TOKEN` viven solo en los ajustes de producción. Cada deploy de `main` necesita `GELPY_RELEASE_TOKEN`: sin él, el build queda en rojo. Sin `GELPY_WIKI_TOKEN`, la sincronización de la wiki se omite con una línea en el log.
- Los PR de features hacen merge directo a `main`, así que el paso de release compara la versión de `package.json` en `HEAD` con la de `HEAD^1` (Work Item 003-037):
  - **Versión cambiada** (un PR de release desde `release/vX.Y.Z`): el tag `v<versión>` debe faltar o estar en el commit desplegado, y el release se crea desde su sección de `CHANGELOG.md`, que debe existir.
  - **Versión sin cambio** (un merge de feature): no hay release. Un tag en un commit anterior es lo esperado y solo se registra.
  - **Siempre rojo:** falta el token o el SHA del commit, un release sin tag, un padre o una versión ilegibles, o un error de la API.
- Los pasos que llaman a Cloudflare corren bajo `timeout` de coreutils, que detiene todo su árbol de procesos. En un primer cutover, el live check usa DNS sobre HTTPS cuando el resolvedor del build aún guarda el "no existe" anterior.
- La wiki es un espejo generado de `docs/` (`npm run wiki:build`). La sincronización es idempotente, registra solo nombres de páginas y borra las páginas que `docs/` ya no tiene.
- `.github/workflows/pages.yml` es el failover: corre solo a mano, con sus triggers originales bajo `# FAILOVER`.

## Repos relacionados

Consulta la tabla del ecosistema en `gelpy-architecture/README.md`.

Los agentes empiezan por [`AGENTS.md`](AGENTS.md).
