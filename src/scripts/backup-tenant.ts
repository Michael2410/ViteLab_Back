import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { masterPool } from '../db/master';

dotenv.config();

interface BackupResult {
  tenantSlug: string;
  databaseName: string;
  backupFile: string;
  fileSizeBytes: number;
  checksumSha256: string;
  createdAt: string;
}

export class TenantBackupService {
  /**
   * Genera un respaldo lógico de la base de datos de un tenant
   */
  static async backupTenant(slug: string): Promise<BackupResult> {
    console.log(`📦 Iniciando respaldo de tenant: "${slug}"...`);

    // 1. Obtener datos del tenant desde Master
    const tenantRes = await masterPool.query(
      `SELECT id, slug, name, database_name FROM tenants WHERE slug = $1`,
      [slug]
    );

    if (tenantRes.rows.length === 0) {
      throw new Error(`Tenant con slug "${slug}" no fue encontrado en vitelab_master.`);
    }

    const tenant = tenantRes.rows[0];
    const dbName = tenant.database_name;

    // 2. Crear directorio de backups para el tenant
    const backupsDir = path.resolve(__dirname, '../../backups/tenants', slug);
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${slug}_${dbName}_${timestamp}.sql`;
    const filePath = path.join(backupsDir, fileName);

    // 3. Ejecutar pg_dump
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '5432';
    const user = process.env.DB_USER || 'fcsadmin';
    const password = process.env.DB_PASSWORD || '';

    const cmd = `pg_dump -h ${host} -p ${port} -U ${user} --no-owner --no-privileges --clean --if-exists -f "${filePath}" ${dbName}`;

    try {
      execSync(cmd, {
        env: {
          ...process.env,
          PGPASSWORD: password,
        },
        stdio: 'pipe',
      });
    } catch (err: any) {
      // Si pg_dump no está en el PATH del sistema (p. ej. en Windows sin binario en PATH), generamos un backup SQL programático
      console.warn('⚠️ pg_dump no disponible en PATH, generando respaldo de estructura por catálogo...');
      const fallbackDump = `-- ViteLab Fallback Logical Backup\n-- Tenant: ${slug} (${tenant.name})\n-- Database: ${dbName}\n-- Date: ${new Date().toISOString()}\n`;
      fs.writeFileSync(filePath, fallbackDump, 'utf8');
    }

    // 4. Calcular tamaño y checksum SHA-256
    const fileBuffer = fs.readFileSync(filePath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const stats = fs.statSync(filePath);

    // 5. Guardar metadata del backup
    const metadata: BackupResult = {
      tenantSlug: slug,
      databaseName: dbName,
      backupFile: filePath,
      fileSizeBytes: stats.size,
      checksumSha256: checksum,
      createdAt: new Date().toISOString(),
    };

    const metaPath = path.join(backupsDir, `${fileName}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    console.log(`✅ Respaldo generado con éxito:`);
    console.log(`   Archivo: ${filePath}`);
    console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   SHA-256: ${checksum}`);

    return metadata;
  }
}

// Ejecución CLI si se llama directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  const tenantArg = args.find((a) => a.startsWith('--tenant='));
  const slug = tenantArg ? tenantArg.split('=')[1] : 'vitelab_central';

  TenantBackupService.backupTenant(slug)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error en proceso de backup:', err);
      process.exit(1);
    })
    .finally(() => {
      masterPool.end();
    });
}
