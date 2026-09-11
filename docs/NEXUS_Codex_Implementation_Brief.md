# NEXUS V1 Codex Implementation Brief

Build NEXUS V1 as a single-owner personal digital universe web application.

## Objective

Create a production-ready monorepo with:

- Angular 21+ frontend using TypeScript, SCSS, and Three.js.
- NestJS backend using TypeScript.
- PostgreSQL database using JSONB for flexible resume content.
- S3-compatible object storage for resume photos, generated files, and backups.
- Resume Studio as the only active V1 module.
- AI reserved architecturally but not implemented in V1.

## Product Shape

NEXUS opens into a cinematic particle universe. The universe is navigation, not decoration. V1 has no central menu planet and no fake modules. The only working node is Resume, which appears through proximity interaction and opens Resume Studio through a short zoom or fly-through transition.

Resume Studio includes a dashboard, create flow, five templates, inline A4 editor, drag and drop sections, autosave, local recovery, PDF export, and public read-only resume links with custom slugs, QR codes, and published snapshots.

## Suggested Phase Order

1. Monorepo foundation: apps/web, apps/api, shared libraries, environment config, PostgreSQL connection, migrations, health check.
2. Universe shell: Three.js particle layers, NEXUS intro, skip behavior, Resume node states, adaptive quality, transition into Resume Studio.
3. Resume dashboard and data model: resume CRUD, template registry, duplicate, rename, delete, settings basics.
4. Inline editor: A4 page surface, field editing, section controls, drag and drop, skills chips, projects, multi-position experience, lightweight rich text.
5. Renderer and templates: shared renderer, A4 pagination rules, Tech Core, Tech Modern, Tech Minimal, Tech Executive, Tech Creative.
6. Autosave and recovery: backend autosave, local unsynced draft recovery, save status, retry and conflict handling.
7. Publication and export: custom slug, published snapshot, publish changes, unpublish, public read-only route, QR download, PDF export, SEO metadata.
8. Hardening: upload validation, logs without sensitive content, backups, data export/import, tests, browser/mobile QA, performance tuning.

## Critical Rules

- Do not implement AI features in V1.
- Do not build traditional login/register as a V1 product feature, but protect private owner routes in deployment.
- Do not let public links expose database IDs or draft data.
- Do not make public resume pages load the full universe or editor bundle.
- Do not let users freely change resume font, arbitrary colors, or font sizes inside inline content; templates own layout and typography.
- Do not use skill percentage bars in tech templates.

## V1 Acceptance

The app is acceptable when the owner can enter NEXUS, open Resume Studio, create a resume, choose any of the five templates, edit inline on A4 pages, reorder and hide sections, autosave and recover work, export a clean A4 PDF, publish a read-only resume at /r/:slug, update it through Publish Changes, generate a QR code, and unpublish it safely.

## Plugin Notes

No extra plugin must be installed before development. Useful later: GitHub for repo and PR management, Cloudflare for deployment or R2/Zero Trust, and Google Drive or Dropbox only if exports/backups should sync there.
