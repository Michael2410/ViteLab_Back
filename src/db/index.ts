import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from '../config/database';
import * as schema from './drizzle-generated/schema';
import * as relations from './drizzle-generated/relations';
import * as almacen from './almacen/schema';

export const db = drizzle(pool, {
  schema: { ...schema, ...relations, ...almacen },
});

export * from './drizzle-generated/schema';
export * from './almacen/schema';
export { relations };
export type DB = typeof db;
export default db;
