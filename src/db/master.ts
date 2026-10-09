import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import dotenv from 'dotenv';
import * as masterSchema from './schema/master';

dotenv.config();

const getMasterConnectionString = () => {
  if (process.env.MASTER_DATABASE_URL) return process.env.MASTER_DATABASE_URL;
  return undefined;
};

export const masterPool = getMasterConnectionString()
  ? new Pool({
      connectionString: getMasterConnectionString(),
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.MASTER_DB_POOL_MAX || '5', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  : new Pool({
      host: process.env.MASTER_DB_HOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.MASTER_DB_PORT || process.env.DB_PORT || '5432', 10),
      database: process.env.MASTER_DB_NAME || 'vitelab_master',
      user: process.env.MASTER_DB_USER || process.env.DB_USER || 'fcsadmin',
      password: process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.MASTER_DB_POOL_MAX || '5', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

masterPool.on('error', (err: Error) => {
  console.error('❌ Error inesperado en el pool de vitelab_master:', err);
});

export const masterDb = drizzle(masterPool, {
  schema: masterSchema,
});

export type MasterDB = typeof masterDb;
export * from './schema/master';
