require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkData() {
  try {
    console.log('🔍 Verificando datos en la base de datos...\n');
    
    const tables = ['areas', 'metodos', 'sedes', 'tipos_cliente', 'tarifarios', 'analisis', 'componentes', 'convenios'];
    
    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      const count = parseInt(result.rows[0].count);
      console.log(`📊 ${table.padEnd(20)} → ${count} registros`);
      
      if (count === 0) {
        console.log(`   ⚠️  La tabla ${table} está vacía!`);
      }
    }
    
    console.log('\n✅ Verificación completada');
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkData();
