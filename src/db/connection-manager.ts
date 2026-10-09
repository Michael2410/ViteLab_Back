import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './drizzle-generated/schema';
import * as relations from './drizzle-generated/relations';
import * as almacen from './almacen/schema';

export const tenantFullSchema = { ...schema, ...relations, ...almacen };
export type TenantDB = NodePgDatabase<typeof tenantFullSchema>;

interface TenantInfo {
  id: string;
  slug: string;
  database_name: string;
  db_cluster?: string;
}

interface ManagedPool {
  tenantId: string;
  databaseName: string;
  pool: Pool;
  db: TenantDB;
  activeLeases: number;
  lastUsedAt: number;
}

export interface TenantConnectionLease {
  db: TenantDB;
  pool: Pool;
  release: () => void;
}

export class TenantConnectionManager {
  private pools = new Map<string, ManagedPool>();
  private inFlightCreations = new Map<string, Promise<ManagedPool>>();
  private maxTenantPools: number;
  private poolMaxConnections: number;
  private idlePoolTtlMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.maxTenantPools = parseInt(process.env.MAX_TENANT_POOLS || '10', 10);
    this.poolMaxConnections = parseInt(process.env.TENANT_POOL_MAX || '6', 10);
    this.idlePoolTtlMs = parseInt(process.env.TENANT_POOL_IDLE_TTL_MS || '900000', 10); // 15 minutos

    // Tarea periódica de limpieza de pools inactivos
    this.cleanupInterval = setInterval(() => {
      this.evictIdlePools().catch((err) => {
        console.error('Error al desalojar pools inactivos:', err);
      });
    }, 60000); // Revisar cada minuto

    // Permitir que el proceso termine limpiamente
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Adquiere una conexión/lease para el tenant especificado.
   * Si el pool no existe, lo crea dinámicamente respetando el presupuesto de conexiones.
   */
  async acquire(tenant: TenantInfo): Promise<TenantConnectionLease> {
    let managed = this.pools.get(tenant.id);

    if (!managed) {
      // Evitar crear múltiples pools simultáneos para el mismo tenant
      let creationPromise = this.inFlightCreations.get(tenant.id);
      if (!creationPromise) {
        creationPromise = this.createPool(tenant);
        this.inFlightCreations.set(tenant.id, creationPromise);
      }

      try {
        managed = await creationPromise;
      } finally {
        this.inFlightCreations.delete(tenant.id);
      }
    }

    // Incrementar contador de leases activos
    managed.activeLeases++;
    managed.lastUsedAt = Date.now();

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      if (managed) {
        managed.activeLeases = Math.max(0, managed.activeLeases - 1);
        managed.lastUsedAt = Date.now();
      }
    };

    return {
      db: managed.db,
      pool: managed.pool,
      release,
    };
  }

  private async createPool(tenant: TenantInfo): Promise<ManagedPool> {
    // Si alcanzamos el límite de pools abiertos, desalojar el más antiguo sin leases activos
    if (this.pools.size >= this.maxTenantPools) {
      await this.evictOldestIdlePool();
    }

    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '5432', 10);
    const user = process.env.DB_USER || 'fcsadmin';
    const password = process.env.DB_PASSWORD;
    const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

    const pool = new Pool({
      host,
      port,
      database: tenant.database_name,
      user,
      password,
      ssl,
      min: 0,
      max: this.poolMaxConnections,
      idleTimeoutMillis: 15000, // Cerrar conexiones PostgreSQL individuales inactivas tras 15s
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error(`❌ Error en el pool del tenant [${tenant.slug} / ${tenant.database_name}]:`, err);
    });

    const db = drizzle(pool, {
      schema: tenantFullSchema,
    });

    const managed: ManagedPool = {
      tenantId: tenant.id,
      databaseName: tenant.database_name,
      pool,
      db,
      activeLeases: 0,
      lastUsedAt: Date.now(),
    };

    this.pools.set(tenant.id, managed);
    return managed;
  }

  /**
   * Desaloja el pool inactivo más antiguo cuando se alcanza MAX_TENANT_POOLS
   */
  private async evictOldestIdlePool(): Promise<void> {
    let oldestTenantId: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [id, managed] of this.pools.entries()) {
      if (managed.activeLeases === 0 && managed.lastUsedAt < oldestTimestamp) {
        oldestTimestamp = managed.lastUsedAt;
        oldestTenantId = id;
      }
    }

    if (oldestTenantId) {
      const managed = this.pools.get(oldestTenantId);
      if (managed) {
        this.pools.delete(oldestTenantId);
        try {
          await managed.pool.end();
        } catch (err) {
          console.warn(`Error cerrando pool de ${managed.databaseName}:`, err);
        }
      }
    }
  }

  /**
   * Cierra pools que han estado inactivos por más de idlePoolTtlMs y sin leases activos
   */
  private async evictIdlePools(): Promise<void> {
    const now = Date.now();
    const toClose: ManagedPool[] = [];

    for (const [id, managed] of this.pools.entries()) {
      if (managed.activeLeases === 0 && now - managed.lastUsedAt > this.idlePoolTtlMs) {
        this.pools.delete(id);
        toClose.push(managed);
      }
    }

    for (const managed of toClose) {
      try {
        await managed.pool.end();
      } catch (err) {
        console.warn(`Error cerrando pool inactivo ${managed.databaseName}:`, err);
      }
    }
  }

  /**
   * Retorna métricas de pools y leases activos para observabilidad y pruebas
   */
  getPoolStats(): {
    activeTenants: number;
    pools: Array<{
      tenantId: string;
      databaseName: string;
      activeLeases: number;
      lastUsedAt: number;
    }>;
  } {
    return {
      activeTenants: this.pools.size,
      pools: Array.from(this.pools.values()).map((p) => ({
        tenantId: p.tenantId,
        databaseName: p.databaseName,
        activeLeases: p.activeLeases,
        lastUsedAt: p.lastUsedAt,
      })),
    };
  }

  /**
   * Cierra todos los pools (utilizado al apagar el servidor)
   */
  async closeAll(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    const all = Array.from(this.pools.values());
    this.pools.clear();
    await Promise.allSettled(all.map((m) => m.pool.end()));
  }
}

export const tenantConnectionManager = new TenantConnectionManager();
