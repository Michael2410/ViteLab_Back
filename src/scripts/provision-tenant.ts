import dotenv from 'dotenv';
import { TenantProvisioningService } from '../modules/tenants/provisioning.service';

dotenv.config();

const args = process.argv.slice(2);

function getArgValue(flag: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.split('=')[1] : undefined;
}

async function main() {
  console.log('====================================================');
  console.log('🏗️ VITELAB - PROVISIONING DE NUEVO TENANT');
  console.log('====================================================');

  const slug = getArgValue('slug');
  const name = getArgValue('name');
  const adminEmail = getArgValue('admin-email');
  const adminName = getArgValue('admin-name') || 'Admin';
  const adminLastName = getArgValue('admin-last-name') || 'ViteLab';
  const adminPassword = getArgValue('admin-password');

  if (!slug || !name || !adminEmail) {
    console.error('❌ Parámetros obligatorios faltantes:');
    console.log('Uso:');
    console.log(
      '  npx ts-node src/scripts/provision-tenant.ts --slug=<slug> --name="<Nombre del Lab>" --admin-email=<correo> [--admin-name=<nombre>] [--admin-last-name=<apellido>] [--admin-password=<clave>]'
    );
    process.exit(1);
  }

  try {
    const result = await TenantProvisioningService.provisionTenant({
      slug,
      name,
      adminEmail,
      adminName,
      adminLastName,
      adminPassword,
    });

    console.log('====================================================');
    console.log('✅ APROVISIONAMIENTO EXITOSO');
    console.log('====================================================');
    console.log(`🏢 Tenant ID:      ${result.tenantId}`);
    console.log(`🔖 Slug:           ${result.slug}`);
    console.log(`📛 Nombre:         ${result.name}`);
    console.log(`🗄️ Base de datos:  ${result.databaseName}`);
    console.log(`👤 Admin Email:    ${result.adminEmail}`);
    console.log(`🆔 Identity ID:    ${result.adminIdentityId}`);
    console.log(`📊 Estado Final:   ${result.status} (${result.step})`);
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('\n💥 Error durante el aprovisionamiento:', err.message || err);
    process.exit(1);
  }
}

main();
