import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const getConnectionString = () => {
  if (!process.env.DATABASE_URL) return undefined;
  try {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return process.env.DATABASE_URL;
  }
};

// Configuración del pool de conexiones de PostgreSQL (soporta localhost y DATABASE_URL en la nube)
export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: getConnectionString(),
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'vitelab_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

// Evento de conexión exitosa
pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL');
});

// Evento de error
pool.on('error', (err: Error) => {
  console.error('❌ Error inesperado en la conexión de PostgreSQL:', err);
  process.exit(-1);
});

// Función para verificar la conexión con reintentos
export const testConnection = async (retries = 3, delay = 3000): Promise<boolean> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('🔌 Conexión a BD exitosa:', result.rows[0].now);
      client.release();
      return true;
    } catch (error) {
      console.error(`❌ Error al conectar a la base de datos (intento ${attempt}/${retries}):`, error);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  return false;
};

export default pool;
