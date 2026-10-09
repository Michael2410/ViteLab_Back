import crypto from 'crypto';

const FILE_SIGNING_SECRET =
  process.env.FILE_SIGNING_SECRET || process.env.JWT_ACCESS_SECRET || 'vitelab_file_secret_2026';

/**
 * Genera un token HMAC temporal para permitir la visualización segura de archivos
 * (por ejemplo en etiquetas <img> o visores embebidos de reportes) sin exponer
 * el archivo estáticamente a usuarios no autorizados.
 */
export function generateSignedFileToken(
  tenantId: string,
  type: string,
  filename: string,
  expiresInSeconds: number = 300
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${tenantId}:${type}:${filename}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', FILE_SIGNING_SECRET).update(payload).digest('hex');
  return `${expiresAt}.${hmac}`;
}

/**
 * Valida la firma HMAC y expiración de un token de archivo.
 */
export function verifySignedFileToken(
  tenantId: string,
  type: string,
  filename: string,
  token: string
): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [expiresAtStr, hmac] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
    return false; // Token expirado
  }

  const payload = `${tenantId}:${type}:${filename}:${expiresAt}`;
  const expectedHmac = crypto.createHmac('sha256', FILE_SIGNING_SECRET).update(payload).digest('hex');

  try {
    const hmacBuf = Buffer.from(hmac, 'hex');
    const expectedBuf = Buffer.from(expectedHmac, 'hex');
    if (hmacBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(hmacBuf, expectedBuf);
  } catch {
    return false;
  }
}
