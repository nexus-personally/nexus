# NEXUS V1

NEXUS V1 is a single-owner personal digital universe with Resume Studio as the only active V1 module.

## Local Development

```powershell
npm install --cache .\work\npm-cache
npm run dev
```

- Web: http://localhost:4200
- API: http://localhost:3000/api
- Health: http://localhost:3000/api/health

The API starts with an in-memory repository by default so the vertical slice runs locally without paid services. PostgreSQL and S3-compatible storage boundaries are represented in configuration, SQL migrations, and service interfaces.

## Architecture

- `apps/web`: Angular 21, SCSS, Three.js universe entry, Resume Studio routes.
- `apps/api`: NestJS 12 REST API, validation, publication snapshots, persistence ports.
- `packages/shared`: shared resume types, template registry, slug and content helpers.
- `infra`: local-only Docker Compose and SQL migrations for PostgreSQL/MinIO.

V1 intentionally excludes AI, billing, SaaS accounts, fake future modules, analytics, and paid integrations.
