import './env.js';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresPool } from './postgres.js';

const pool = createPostgresPool();
const migrationsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../infra/migrations');

async function migrate() {
  await pool.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const name of migrationNames) {
    const alreadyApplied = await pool.query('select 1 from schema_migrations where name = $1', [
      name,
    ]);
    if (alreadyApplied.rowCount) continue;

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(await readFile(resolve(migrationsDirectory, name), 'utf8'));
      await client.query('insert into schema_migrations (name) values ($1)', [name]);
      await client.query('commit');
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate()
  .then(() => console.log('Database migrations are up to date.'))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
