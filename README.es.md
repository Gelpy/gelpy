# gelpy

Documentación pública de ingeniería de Gelpy. Este repo es público.

## Estado

El sitio Docusaurus compila en inglés y español y se despliega en `https://docs.gelpy.app` con GitHub Pages. La implementación corre desde `gelpy-architecture/handoffs/fase-1-corrida.md`.

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
```

El tema de Gelpy viene del paquete privado `@gelpy/design-system` en GitHub Packages. Si tienes un token que pueda leerlo, expórtalo como `NODE_AUTH_TOKEN` antes de `npm ci`. Sin token, `npm ci` omite el paquete y el sitio se construye con el tema por defecto. CI define `GELPY_REQUIRE_BRAND=1` en los push y en los pull requests del mismo repositorio, así que ahí falla si falta el tema. Nunca subas un token: `.npmrc` solo lo lee del entorno.

`docs/` tiene la fuente en inglés. Las páginas en español viven en `i18n/es/docusaurus-plugin-content-docs/current/`.

## Validación

`npm run build`, `npm run check:public`, `npm run check:brand`, `npm test`

## Repos relacionados

Consulta la tabla del ecosistema en `gelpy-architecture/README.md`.

Los agentes empiezan por [`AGENTS.md`](AGENTS.md).
