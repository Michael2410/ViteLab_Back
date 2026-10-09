import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { JwtPayload } from '../modules/auth/auth.types';
import { tenantStorage, getActiveTenant } from '../db/tenant-context';
import { tenantConnectionManager } from '../db/connection-manager';

/**
 * Middleware global de resolución y enlace de contexto de Tenant.
 * Conforme a la Sección 13.2 de GUIA-AGENTE.md:
 * - Si la petición contiene un JWT Bearer, resuelve el tenant activo desde sus claims.
 * - Adquiere un lease de conexión en TenantConnectionManager.
 * - Registra la liberación del lease en el evento 'close' y 'finish' de Response.
 * - Envuelve la ejecución en AsyncLocalStorage (tenantStorage.run), permitiendo que
 *   cualquier servicio o controlador que importe `db` consulte la base de datos aislada del tenant.
 */
export const tenantContextMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  // Si ya existe un contexto en curso, continuar directamente
  if (tenantStorage.getStore()) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || 'access_secret'
    ) as JwtPayload;

    const tenantIdentifier = decoded.tenantId || (decoded as any).tenantSlug || 'vitelab_central';
    const tenant = await getActiveTenant(tenantIdentifier);
    const lease = await tenantConnectionManager.acquire(tenant);

    let released = false;
    const releaseOnce = () => {
      if (!released) {
        released = true;
        lease.release();
      }
    };
    res.on('finish', releaseOnce);
    res.on('close', releaseOnce);

    req.user = decoded;

    return tenantStorage.run(
      {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        db: lease.db,
        actor: {
          kind: 'user',
          identityId: decoded.sub || String(decoded.userId),
          usuarioId: decoded.userId,
        },
        requestId: (req.headers['x-request-id'] as string) || randomUUID(),
      },
      () => next()
    );
  } catch {
    // Si el token es inválido o no decodificable, continuar sin contexto
    // Los middlewares dedicados (authenticateToken) rechazarán con 401 si la ruta es protegida
    return next();
  }
};
