const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: 'vitelab_db',
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || ''),
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT d.id, d.personal_id, d.tipo_documento, p.nombres, p.apellidos, p.tipo_documento as colab_tdoc, p.numero_documento, p.cargo, p.fecha_ingreso, p.fecha_cese, p.sueldo_base
    FROM personal_documentos d
    JOIN personal p ON d.personal_id = p.id
  `);
  console.log('DOCS WITH PERSONAL:', JSON.stringify(res.rows, null, 2));
  await client.end();
}

run().catch(console.error);
