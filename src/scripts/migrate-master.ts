import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: 'postgres',
  user: process.env.DB_USER || 'fcsadmin',
  password: process.env.DB_PASSWORD,
});

async function main() {
  console.log('🚀 Iniciando runner de migraciones de Master (vitelab_master)...');

  // 1. Verificar/Crear base de datos vitelab_master si no existe
  const checkDb = await adminPool.query(
    "SELECT datname FROM pg_database WHERE datname = 'vitelab_master'"
  );

  if (checkDb.rows.length === 0) {
    console.log('📦 Creando base de datos vitelab_master...');
    await adminPool.query('CREATE DATABASE vitelab_master');
    console.log('✅ Base de datos vitelab_master creada exitosamente');
  }
  await adminPool.end();

  // 2. Conectar a vitelab_master
  const masterPool = new Pool({
    host: process.env.MASTER_DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.MASTER_DB_PORT || process.env.DB_PORT || '5432', 10),
    database: 'vitelab_master',
    user: process.env.MASTER_DB_USER || process.env.DB_USER || 'fcsadmin',
    password: process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD,
  });

  const client = await masterPool.connect();

  try {
    // 3. Crear tabla schema_migrations si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version      VARCHAR(100) PRIMARY KEY,
        checksum     CHAR(64)     NOT NULL,
        applied_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        duration_ms  INTEGER
      );
    `);

    // 4. Leer archivos de migración en orden
    const migrationsDir = path.join(__dirname, '../db/master/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Encontradas ${files.length} migraciones en master.`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sqlContent, 'utf8').digest('hex');

      const existing = await client.query(
        'SELECT checksum FROM schema_migrations WHERE version = $1',
        [file]
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0].checksum !== checksum) {
          console.warn(`⚠️ ADVERTENCIA: Checksum alterado para migración ya aplicada: ${file}`);
        } else {
          console.log(`⏩ Migración ya aplicada: ${file}`);
        }
        continue;
      }

      console.log(`⚡ Aplicando migración master: ${file}...`);
      const startTime = Date.now();

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        const duration = Date.now() - startTime;
        await client.query(
          `INSERT INTO schema_migrations (version, checksum, duration_ms)
           VALUES ($1, $2, $3)`,
          [file, checksum, duration]
        );
        await client.query('COMMIT');
        console.log(`✅ Aplicada: ${file} (${duration}ms)`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error aplicando ${file}:`, err);
        throw err;
      }
    }

    console.log('🎉 Todas las migraciones de Master están al día.');
  } finally {
    client.release();
    await masterPool.end();
  }
}

main().catch((err) => {
  console.error('❌ Error fatal migrando Master:', err);
  process.exit(1);
});
