import crypto from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { masterDb, masterPublicLinks } from '../../db/master';
import { runInTenant } from '../../db/tenant-context';

export class PublicLinksService {
  /**
   * Crea un enlace público opaco vinculado a un recurso clínico específico
   */
  async createLink(params: {
    tenantId: string;
    purpose: 'RESULT_VIEW' | 'REPORT_VERIFY';
    resourceType: string;
    resourceId: string;
    expiresInHours?: number;
  }): Promise<{ token: string; url: string }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = params.expiresInHours
      ? new Date(Date.now() + params.expiresInHours * 3600 * 1000)
      : null;

    await masterDb.insert(masterPublicLinks).values({
      token_hash: tokenHash,
      tenant_id: params.tenantId,
      purpose: params.purpose,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      expires_at: expiresAt,
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const path = params.purpose === 'REPORT_VERIFY' ? '/verificar-informe' : '/resultados/ver';
    const url = `${baseUrl}${path}?token=${rawToken}`;

    return { token: rawToken, url };
  }

  /**
   * Resuelve y valida un enlace público opaco, ejecutando la consulta en el tenant respectivo
   */
  async resolveLink(rawToken: string): Promise<{
    tenantId: string;
    purpose: string;
    resourceType: string;
    resourceId: string;
  }> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const [link] = await masterDb
      .select()
      .from(masterPublicLinks)
      .where(and(eq(masterPublicLinks.token_hash, tokenHash), isNull(masterPublicLinks.revoked_at)));

    if (!link) {
      throw new Error('Enlace no válido o revocado');
    }

    if (link.expires_at && new Date() > new Date(link.expires_at)) {
      throw new Error('El enlace ha expirado');
    }

    return {
      tenantId: link.tenant_id,
      purpose: link.purpose,
      resourceType: link.resource_type,
      resourceId: link.resource_id,
    };
  }

  /**
   * Revoca un enlace público
   */
  async revokeLink(rawToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await masterDb
      .update(masterPublicLinks)
      .set({ revoked_at: new Date() })
      .where(eq(masterPublicLinks.token_hash, tokenHash));
  }
}

export const publicLinksService = new PublicLinksService();
