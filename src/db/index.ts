import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from '../config/database';
import * as schema from './drizzle-generated/schema';
import * as relations from './drizzle-generated/relations';

export const db = drizzle(pool, {
  schema: { ...schema, ...relations },
});

export * from './drizzle-generated/schema';
export { relations };
export type DB = typeof db;
export default db;
