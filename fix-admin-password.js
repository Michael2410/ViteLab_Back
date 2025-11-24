const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

async function fixAdminPassword() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    // Generar hash de la contraseña 'admin123'
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);

    console.log('🔑 Generando hash para contraseña:', password);
    console.log('📝 Hash generado:', hash);

    // Actualizar el usuario admin
    const result = await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE username = $2 RETURNING id, username, email',
      [hash, 'admin']
    );

    if (result.rows.length > 0) {
      console.log('✅ Contraseña actualizada para usuario:', result.rows[0]);
      console.log('\n🎉 Ahora puedes iniciar sesión con:');
      console.log('   Usuario: admin');
      console.log('   Contraseña: admin123');
    } else {
      console.log('❌ Usuario "admin" no encontrado en la base de datos');
      console.log('   Ejecuta primero el script database.sql');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixAdminPassword();
