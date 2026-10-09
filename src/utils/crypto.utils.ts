import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recomendado para GCM
const KEY_PREFIX = 'v1';

function getEncryptionKey(): Buffer {
  const envKey = process.env.MFA_ENCRYPTION_KEY || 'vitelab_mfa_default_key_32_bytes_len!';
  // Garantizar exactamente 32 bytes (256 bits) usando sha256 si la llave no tiene 32 bytes exactos
  if (Buffer.byteLength(envKey) === 32) {
    return Buffer.from(envKey);
  }
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Cifra un secreto MFA (TOTP) utilizando AES-256-GCM.
 * Formato resultante: v1:iv_hex:ciphertext_hex:tag_hex
 */
export function encryptMfaSecret(secret: string): string {
  if (!secret) return secret;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(secret, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return `${KEY_PREFIX}:${iv.toString('hex')}:${ciphertext}:${tag.toString('hex')}`;
}

/**
 * Descifra un secreto MFA (TOTP) cifrado en formato v1:iv:ciphertext:tag.
 */
export function decryptMfaSecret(encryptedSecret: string): string {
  if (!encryptedSecret) return encryptedSecret;

  const parts = encryptedSecret.split(':');
  if (parts.length !== 4 || parts[0] !== KEY_PREFIX) {
    // Si no tiene el formato v1, retornar como texto plano si ya venía así (para migración segura)
    return encryptedSecret;
  }

  const [, ivHex, ciphertextHex, tagHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Genera un hash seguro SHA-256 para almacenar códigos de respaldo MFA
 */
export function hashBackupCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Verifica si un código de respaldo coincide con un hash guardado
 */
export function verifyBackupCode(inputCode: string, codeHash: string): boolean {
  const computed = hashBackupCode(inputCode);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(codeHash));
}
