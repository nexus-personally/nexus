# NEXUS V1

NEXUS V1 is a single-owner personal digital universe with Resume Studio as the only active V1 module.

## Local Development

### New Windows computer (local PostgreSQL)

Install Node.js 24+, Git, and PostgreSQL 18. Then open PowerShell in the project
directory and run:

```powershell
Copy-Item .env.example .env
npm install
npm run db:local:up
npm run db:migrate
npm run dev
```

Before starting, set these values in `.env`:

```env
PERSISTENCE=postgres
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5433
POSTGRES_DB=nexus
POSTGRES_USER=nexus
POSTGRES_PASSWORD=nexus_dev_only
POSTGRES_SSL=false
```

Keep the `npm run dev` terminal open. Press `Ctrl+C` to stop the web app and API,
then stop the local database with:

```powershell
npm run db:local:down
```

The database files are stored under `work/postgres-data` and remain available
after the database is stopped.

### Docker alternative

Install and start [Docker Desktop](https://www.docker.com/products/docker-desktop/),
copy `.env.example` to `.env`, then run:

```powershell
npm install
npm run db:up
npm run db:migrate
npm run dev
```

Use `npm run db:down` to stop the Docker services.

- Web: http://localhost:4200
- API: http://localhost:3000/api
- Health: http://localhost:3000/api/health

The Angular app calls the real Nest API through its local `/api` proxy. With
`PERSISTENCE=postgres`, resume edits, duplicates, deletes, and publications are
stored in PostgreSQL and survive restarts. Use `PERSISTENCE=in-memory` when a
temporary database-free session is useful.

For a cloud PostgreSQL service, set `DATABASE_URL` and usually
`POSTGRES_SSL=true`, run `npm run db:migrate`, then start the API. The API is the
only component that receives database credentials; the browser continues to call
`/api`. Point the domain's reverse proxy at the web app and route `/api` to the
Nest service.

## Architecture

- `apps/web`: Angular 21, SCSS, Three.js universe entry, Resume Studio routes.
- `apps/api`: NestJS 12 REST API, validation, publication snapshots, persistence ports.
- `packages/shared`: shared resume types, template registry, slug and content helpers.
- `infra`: local-only Docker Compose and SQL migrations for PostgreSQL/MinIO.

V1 intentionally excludes AI, billing, SaaS accounts, fake future modules, analytics, and paid integrations.
