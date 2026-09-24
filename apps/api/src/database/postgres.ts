import { Pool, type PoolConfig } from 'pg';

export function createPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  // Render Postgres internal TLS uses a self-signed certificate. Render documents
  // that verification is unsupported for internal URLs; TLS remains required.
  const ssl = process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false, minVersion: 'TLSv1.2' as const } : undefined;
  const config: PoolConfig = connectionString
    ? { connectionString, ssl }
    : {
        host: process.env.POSTGRES_HOST ?? 'localhost',
        port: Number(process.env.POSTGRES_PORT ?? 5432),
        database: process.env.POSTGRES_DB ?? 'nexus',
        user: process.env.POSTGRES_USER ?? 'nexus',
        password: process.env.POSTGRES_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'nexus_dev_only'),
        ssl,
      };

  return new Pool(config);
}
