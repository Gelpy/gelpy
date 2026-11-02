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
npm test           # Pruebas de la revisión de seguridad pública
```

`docs/` tiene la fuente en inglés. Las páginas en español viven en `i18n/es/docusaurus-plugin-content-docs/current/`.

## Validación

`npm run build`, `npm run check:public`, `npm test`

## Repos relacionados

Consulta la tabla del ecosistema en `gelpy-architecture/README.md`.

Los agentes empiezan por [`AGENTS.md`](AGENTS.md).
