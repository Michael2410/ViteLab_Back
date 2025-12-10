const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'vitelab_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function checkTables() {
  try {
    console.log('=== TABLA ANALISIS ===');
    const analisis = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'analisis' 
      ORDER BY ordinal_position
    `);
    console.table(analisis.rows);

    console.log('=== TABLA ORDENES ===');
    const ordenes = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'ordenes' 
      ORDER BY ordinal_position
    `);
    console.table(ordenes.rows);

    console.log('\n=== TABLA ORDEN_ANALISIS ===');
    const ordenAnalisis = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'orden_analisis' 
      ORDER BY ordinal_position
    `);
    console.table(ordenAnalisis.rows);

    console.log('\n=== TABLA PACIENTES ===');
    const pacientes = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'pacientes' 
      ORDER BY ordinal_position
    `);
    console.table(pacientes.rows);

    console.log('\n=== TABLA USUARIOS ===');
    const usuarios = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'usuarios' 
      ORDER BY ordinal_position
    `);
    console.table(usuarios.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
