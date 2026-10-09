import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './drizzle-generated/schema';
import * as relations from './drizzle-generated/relations';
import * as almacen from './almacen/schema';
import { tenantConnectionManager } from './connection-manager';
import { masterDb, masterTenants } from './master';
import { eq, and } from 'drizzle-orm';

export const tenantFullSchema = { ...schema, ...relations, ...almacen };
export type TenantDB = NodePgDatabase<typeof tenantFullSchema>;

export type Actor =
  | { kind: 'user'; identityId: string; usuarioId: number }
  | { kind: 'system'; job: string } // crons, colas, WhatsApp, workers
  | { kind: 'support'; identityId: string; grantId: string };

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  db: TenantDB;
  actor: Actor;
  requestId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Obtiene el contexto de tenant actual.
 * Lanza un error explícito si se invoca fuera de un contexto (Fail-Closed).
 */
export function getTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error('Acceso a la BD de tenant sin contexto (Fail-Closed: Operación rechazada)');
  }
  return ctx;
}

// Caché en memoria para metadatos de tenants activos (TTL 60s)
interface CachedTenant {
  id: string;
  slug: string;
  name: string;
  database_name: string;
  db_cluster: string;
  status: string;
  expiresAt: number;
}
const tenantMetadataCache = new Map<string, CachedTenant>();

export async function getActiveTenant(tenantIdentifier: string): Promise<CachedTenant> {
  const now = Date.now();
  const cached = tenantMetadataCache.get(tenantIdentifier);
  if (cached && cached.expiresAt > now) {
    return cached;
  }

  // Buscar por ID o por Slug en vitelab_master
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier);
  const [tenant] = await masterDb
    .select({
      id: masterTenants.id,
      slug: masterTenants.slug,
      name: masterTenants.name,
      database_name: masterTenants.database_name,
      db_cluster: masterTenants.db_cluster,
      status: masterTenants.status,
    })
    .from(masterTenants)
    .where(
      and(
        isUuid ? eq(masterTenants.id, tenantIdentifier) : eq(masterTenants.slug, tenantIdentifier),
        eq(masterTenants.status, 'ACTIVE')
      )
    );

  if (!tenant) {
    throw new Error(`Tenant '${tenantIdentifier}' no encontrado o no está ACTIVE`);
  }

  const record: CachedTenant = {
    ...tenant,
    expiresAt: now + 60000, // 60 segundos TTL
  };

  tenantMetadataCache.set(tenant.id, record);
  tenantMetadataCache.set(tenant.slug, record);

  return record;
}

/**
 * Ejecuta una función dentro del contexto seguro de un tenant.
 * Adquiere un lease de conexión, corre la función y garantiza el release en el finally.
 * Requerido para: WebSockets, WhatsApp (Baileys), tareas programadas, crons y scripts CLI.
 */
export async function runInTenant<T>(
  tenantIdentifier: string,
  actor: Actor,
  fn: () => Promise<T>
): Promise<T> {
  const tenant = await getActiveTenant(tenantIdentifier);
  const lease = await tenantConnectionManager.acquire(tenant);

  try {
    return await tenantStorage.run(
      {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        db: lease.db,
        actor,
        requestId: randomUUID(),
      },
      fn
    );
  } finally {
    lease.release();
  }
}
