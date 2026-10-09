import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from '../config/database';
import * as schema from './drizzle-generated/schema';
import * as relations from './drizzle-generated/relations';
import * as almacen from './almacen/schema';
import { tenantStorage, TenantDB } from './tenant-context';

export const tenantFullSchema = { ...schema, ...relations, ...almacen };

// Instancia legacy para soporte de rollback seguro si AUTH_SOURCE === 'legacy'
const legacyDb = drizzle(pool, { schema: tenantFullSchema });

/**
 * Proxy dinámico hacia la base de datos del tenant autenticado en el contexto actual.
 * Conforme a Sección 13.2 de GUIA-AGENTE.md:
 * - Resuelve la instancia Drizzle del tenant en curso.
 * - Si no hay contexto y AUTH_SOURCE === 'master', LANZA ERROR (Fail-Closed: Nunca cae a Master ni a otra BD por defecto).
 * - Si AUTH_SOURCE === 'legacy', permite usar la conexión legacy para garantizar el rollback sin riesgo.
 */
export const db = new Proxy({} as TenantDB, {
  get(_target, prop) {
    const ctx = tenantStorage.getStore();
    if (ctx?.db) {
      const value = Reflect.get(ctx.db, prop, ctx.db);
      return typeof value === 'function' ? value.bind(ctx.db) : value;
    }

    const authSource = process.env.AUTH_SOURCE || 'master';
    if (authSource === 'legacy') {
      const value = Reflect.get(legacyDb, prop, legacyDb);
      return typeof value === 'function' ? value.bind(legacyDb) : value;
    }

    throw new Error(`Acceso a la BD de tenant sin contexto (propiedad: ${String(prop)}) [Fail-Closed]`);
  },
});

export * from './drizzle-generated/schema';
export * from './almacen/schema';
export { relations };
export { masterDb } from './master';
export { runInTenant, getTenantContext, tenantStorage } from './tenant-context';
export { tenantConnectionManager } from './connection-manager';
export type DB = TenantDB;
export default db;
