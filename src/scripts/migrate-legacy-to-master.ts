import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { encryptMfaSecret, hashBackupCode } from '../utils/crypto.utils';

dotenv.config();

const masterPool = new Pool({
  host: process.env.MASTER_DB_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.MASTER_DB_PORT || process.env.DB_PORT || '5432', 10),
  database: process.env.MASTER_DB_NAME || 'vitelab_master',
  user: process.env.MASTER_DB_USER || process.env.DB_USER || 'fcsadmin',
  password: process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD,
});

const tenantPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'vitelab_db',
  user: process.env.DB_USER || 'fcsadmin',
  password: process.env.DB_PASSWORD,
});

async function main() {
  console.log('🔄 Iniciando migración y backfill de usuarios existentes a vitelab_master...');

  // 1. Aplicar migración 030 en vitelab_db (Paso Expand)
  console.log('📦 Paso 1 (Expand): Asegurando columna identity_id en vitelab_db.usuarios...');
  const migration030Path = path.join(__dirname, '../../update BD/030_tenant_add_identity_id.sql');
  const sql030 = fs.readFileSync(migration030Path, 'utf8');
  await tenantPool.query(sql030);
  console.log('✅ Columna identity_id creada/verificada en vitelab_db.usuarios');

  // 2. Registrar el tenant inicial en vitelab_master
  console.log('🏢 Paso 2: Registrando tenant inicial (vitelab_central)...');
  const tenantRes = await masterPool.query(`
    INSERT INTO tenants (slug, name, database_name, db_cluster, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name, database_name = EXCLUDED.database_name, status = EXCLUDED.status, updated_at = now()
    RETURNING id, slug, name, database_name;
  `, ['vitelab_central', 'ViteLab Central', 'vitelab_db', 'default', 'ACTIVE']);

  const tenant = tenantRes.rows[0];
  console.log(`✅ Tenant registrado: [${tenant.slug}] ID: ${tenant.id} -> BD: ${tenant.database_name}`);

  // 3. Obtener todos los usuarios existentes en vitelab_db
  console.log('👥 Paso 3: Leyendo usuarios de vitelab_db.usuarios...');
  const usersRes = await tenantPool.query(`
    SELECT id, username, email, password_hash, activo, 
           two_factor_enabled, two_factor_secret, two_factor_backup_codes,
           identity_id
    FROM usuarios
    ORDER BY id ASC;
  `);

  console.log(`📋 Se encontraron ${usersRes.rows.length} usuarios para migrar.`);

  for (const user of usersRes.rows) {
    const normalizedEmail = user.email.trim().toLowerCase();
    console.log(`\n🔹 Procesando usuario #${user.id} [${user.username}] - Email: ${normalizedEmail}`);

    // Cifrar secreto TOTP si existe
    let mfaSecretEnc: string | null = null;
    if (user.two_factor_secret) {
      mfaSecretEnc = encryptMfaSecret(user.two_factor_secret);
    }

    // Insertar o recuperar identidad en Master
    const identityRes = await masterPool.query(`
      INSERT INTO identities (
        email, email_verified_at, password_hash, status, 
        mfa_enabled, mfa_secret_enc, mfa_enrolled_at
      )
      VALUES ($1, now(), $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE
        SET password_hash = COALESCE(EXCLUDED.password_hash, identities.password_hash),
            mfa_enabled = EXCLUDED.mfa_enabled,
            mfa_secret_enc = COALESCE(EXCLUDED.mfa_secret_enc, identities.mfa_secret_enc),
            updated_at = now()
      RETURNING id, email, status, mfa_enabled;
    `, [
      normalizedEmail,
      user.password_hash,
      user.activo ? 'ACTIVE' : 'DISABLED',
      Boolean(user.two_factor_enabled),
      mfaSecretEnc,
      user.two_factor_enabled ? new Date() : null,
    ]);

    const identity = identityRes.rows[0];
    const identityId = identity.id;
    console.log(`   ↳ Identity en Master: ${identityId} (2FA: ${identity.mfa_enabled})`);

    // Migrar códigos de respaldo si tiene 2FA y códigos guardados
    if (user.two_factor_enabled && user.two_factor_backup_codes) {
      try {
        const rawCodes: string[] = typeof user.two_factor_backup_codes === 'string'
          ? JSON.parse(user.two_factor_backup_codes)
          : user.two_factor_backup_codes;

        if (Array.isArray(rawCodes) && rawCodes.length > 0) {
          // Limpiar códigos anteriores de esta identidad si existieran
          await masterPool.query('DELETE FROM mfa_backup_codes WHERE identity_id = $1', [identityId]);

          for (const code of rawCodes) {
            const hashed = hashBackupCode(code);
            await masterPool.query(`
              INSERT INTO mfa_backup_codes (identity_id, code_hash)
              VALUES ($1, $2);
            `, [identityId, hashed]);
          }
          console.log(`   ↳ Migrados ${rawCodes.length} códigos de respaldo hasheados.`);
        }
      } catch (err) {
        console.warn(`   ⚠️ No se pudieron migrar códigos de respaldo para ${user.username}:`, err);
      }
    }

    // Crear/Actualizar Membership
    const membershipStatus = user.activo ? 'ACTIVE' : 'SUSPENDED';
    await masterPool.query(`
      INSERT INTO memberships (identity_id, tenant_id, status, accepted_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (identity_id, tenant_id) DO UPDATE
        SET status = EXCLUDED.status, updated_at = now();
    `, [identityId, tenant.id, membershipStatus]);
    console.log(`   ↳ Membership vinculada en Master con estado: ${membershipStatus}`);

    // Actualizar identity_id en vitelab_db.usuarios
    await tenantPool.query(`
      UPDATE usuarios 
      SET identity_id = $1 
      WHERE id = $2;
    `, [identityId, user.id]);
    console.log(`   ↳ BD Tenant actualizada: usuarios.id ${user.id} -> identity_id ${identityId}`);
  }

  // 4. Verificar que no queden nulos
  console.log('\n🔍 Paso 4: Verificando integridad de identity_id en vitelab_db.usuarios...');
  const nullCheck = await tenantPool.query(`
    SELECT count(*)::int AS null_count 
    FROM usuarios 
    WHERE identity_id IS NULL;
  `);

  if (nullCheck.rows[0].null_count > 0) {
    throw new Error(`❌ Error: Se encontraron ${nullCheck.rows[0].null_count} usuarios sin identity_id`);
  }
  console.log('✅ Integridad confirmada: 0 registros nulos.');

  // 5. Aplicar constraint NOT NULL e índice único en vitelab_db
  console.log('🔒 Paso 5: Aplicando SET NOT NULL y UNIQUE INDEX en vitelab_db.usuarios...');
  await tenantPool.query(`
    ALTER TABLE usuarios ALTER COLUMN identity_id SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_identity_id ON usuarios(identity_id);
  `);
  console.log('✅ Restricciones NOT NULL y UNIQUE INDEX uq_usuarios_identity_id creadas.');

  console.log('\n🎉 ¡MIGRACIÓN DE IDENTIDADES Y TENANT COMPLETADA CON ÉXITO!');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`Tenant:          ${tenant.name} (${tenant.slug})`);
  console.log(`Tenant ID:       ${tenant.id}`);
  console.log(`Usuarios:        ${usersRes.rows.length} sincronizados`);
  console.log('═══════════════════════════════════════════════════════════════════');

  await masterPool.end();
  await tenantPool.end();
}

main().catch((err) => {
  console.error('❌ Error fatal en la migración:', err);
  process.exit(1);
});
