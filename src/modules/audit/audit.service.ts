import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { getTenantContext } from '../../db/tenant-context';

export interface AuditRecordParams {
  identityId?: string | null;
  usuarioId?: number | null;
  actorTipo?: 'user' | 'system' | 'support';
  accion: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'APPROVE' | 'EXPORT' | 'PRINT' | string;
  recurso: string;
  recursoId?: string | number | null;
  valoresAntes?: any;
  valoresDespues?: any;
  resultado?: 'SUCCESS' | 'FAILURE' | string;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export class AuditService {
  /**
   * Registra un evento de auditoría append-only en la base de datos del tenant activo.
   */
  async record(params: AuditRecordParams): Promise<void> {
    try {
      let context: any;
      try {
        context = getTenantContext();
      } catch {
        context = null;
      }
      
      const actor = context?.actor;

      const effectiveIdentityId =
        params.identityId ||
        (actor && 'identityId' in actor ? actor.identityId : '00000000-0000-0000-0000-000000000000');

      const effectiveUsuarioId =
        params.usuarioId !== undefined
          ? params.usuarioId
          : actor && 'usuarioId' in actor
          ? actor.usuarioId
          : null;

      const effectiveActorTipo =
        params.actorTipo || (actor?.kind ? actor.kind : 'system');

      await db.execute(sql`
        INSERT INTO auditoria (
          identity_id,
          usuario_id,
          actor_tipo,
          accion,
          recurso,
          recurso_id,
          valores_antes,
          valores_despues,
          resultado,
          ip,
          user_agent,
          request_id
        ) VALUES (
          ${effectiveIdentityId}::uuid,
          ${effectiveUsuarioId},
          ${effectiveActorTipo},
          ${params.accion},
          ${params.recurso},
          ${params.recursoId ? String(params.recursoId) : null},
          ${params.valoresAntes ? JSON.stringify(params.valoresAntes) : null}::jsonb,
          ${params.valoresDespues ? JSON.stringify(params.valoresDespues) : null}::jsonb,
          ${params.resultado || 'SUCCESS'},
          ${params.ip || null}::inet,
          ${params.userAgent || null},
          ${params.requestId ? params.requestId : null}::uuid
        )
      `);
    } catch (err) {
      console.warn('⚠️ Error al registrar en auditoría del tenant:', err);
    }
  }

  /**
   * Consulta el registro de auditoría del tenant
   */
  async getAuditLog(limit: number = 50, offset: number = 0) {
    const result = await db.execute(sql`
      SELECT 
        a.id,
        a.identity_id,
        a.usuario_id,
        a.actor_tipo,
        a.accion,
        a.recurso,
        a.recurso_id,
        a.valores_antes,
        a.valores_despues,
        a.resultado,
        a.ip,
        a.user_agent,
        a.request_id,
        a.created_at,
        u.username
      FROM auditoria a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return result.rows;
  }
}

export const auditService = new AuditService();
