import { Pool, type PoolConfig } from 'pg';

export function createPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  const ssl = process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined;
  const config: PoolConfig = connectionString
    ? { connectionString, ssl }
    : {
        host: process.env.POSTGRES_HOST ?? 'localhost',
        port: Number(process.env.POSTGRES_PORT ?? 5432),
        database: process.env.POSTGRES_DB ?? 'nexus',
        user: process.env.POSTGRES_USER ?? 'nexus',
        password: process.env.POSTGRES_PASSWORD ?? 'nexus_dev_only',
        ssl,
      };

  return new Pool(config);
}
