/**
 * Adaptador de Auth State para Baileys usando PostgreSQL
 * Reemplaza el almacenamiento en archivos JSON por BD
 * Esto permite que las sesiones persistan en contenedores Docker
 */

import { AuthenticationCreds, AuthenticationState, SignalDataTypeMap, initAuthCreds, proto, BufferJSON } from '@whiskeysockets/baileys';
import pool from '../../config/database';

const SESSION_ID = 'default';

/**
 * Guarda un valor en la BD
 */
const saveData = async (key: string, value: unknown): Promise<void> => {
  const serialized = JSON.stringify(value, BufferJSON.replacer);
  
  await pool.query(
    `INSERT INTO whatsapp_sessions (session_id, data_key, data_value, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (session_id, data_key) 
     DO UPDATE SET data_value = $3, updated_at = NOW()`,
    [SESSION_ID, key, serialized]
  );
};

/**
 * Obtiene un valor de la BD
 */
const getData = async <T>(key: string): Promise<T | null> => {
  const result = await pool.query(
    'SELECT data_value FROM whatsapp_sessions WHERE session_id = $1 AND data_key = $2',
    [SESSION_ID, key]
  );
  
  if (result.rows.length === 0 || !result.rows[0].data_value) {
    return null;
  }
  
  return JSON.parse(result.rows[0].data_value, BufferJSON.reviver);
};

/**
 * Elimina un valor de la BD
 */
const removeData = async (key: string): Promise<void> => {
  await pool.query(
    'DELETE FROM whatsapp_sessions WHERE session_id = $1 AND data_key = $2',
    [SESSION_ID, key]
  );
};

/**
 * Elimina múltiples valores que coincidan con un patrón
 */
export const removeDataByPrefix = async (prefix: string): Promise<void> => {
  await pool.query(
    'DELETE FROM whatsapp_sessions WHERE session_id = $1 AND data_key LIKE $2',
    [SESSION_ID, `${prefix}%`]
  );
};

/**
 * Hook principal que crea el estado de autenticación usando PostgreSQL
 */
export const useBaileysAuthStateDB = async (): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearState: () => Promise<void>;
}> => {
  // Intentar cargar credenciales existentes
  let creds: AuthenticationCreds = await getData<AuthenticationCreds>('creds') || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          
          for (const id of ids) {
            const key = `${type}-${id}`;
            const value = await getData<SignalDataTypeMap[T]>(key);
            if (value) {
              if (type === 'app-state-sync-key' && value) {
                data[id] = proto.Message.AppStateSyncKeyData.fromObject(value as object) as unknown as SignalDataTypeMap[T];
              } else {
                data[id] = value;
              }
            }
          }
          
          return data;
        },
        set: async (data: Record<string, Record<string, unknown>>): Promise<void> => {
          for (const category in data) {
            for (const id in data[category]) {
              const key = `${category}-${id}`;
              const value = data[category][id];
              
              if (value) {
                await saveData(key, value);
              } else {
                await removeData(key);
              }
            }
          }
        }
      }
    },
    saveCreds: async (): Promise<void> => {
      await saveData('creds', creds);
    },
    clearState: async (): Promise<void> => {
      await pool.query('DELETE FROM whatsapp_sessions WHERE session_id = $1', [SESSION_ID]);
    }
  };
};

/**
 * Actualiza el estado de conexión en la BD
 */
export const updateConnectionStatus = async (
  isConnected: boolean,
  phoneNumber?: string
): Promise<void> => {
  const now = new Date().toISOString();
  
  await pool.query(
    `INSERT INTO whatsapp_connection_status (session_id, is_connected, phone_number, last_connected_at, last_disconnected_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (session_id) 
     DO UPDATE SET 
       is_connected = $2, 
       phone_number = COALESCE($3, whatsapp_connection_status.phone_number),
       last_connected_at = CASE WHEN $2 = true THEN $4 ELSE whatsapp_connection_status.last_connected_at END,
       last_disconnected_at = CASE WHEN $2 = false THEN $5 ELSE whatsapp_connection_status.last_disconnected_at END,
       updated_at = NOW()`,
    [SESSION_ID, isConnected, phoneNumber, isConnected ? now : null, !isConnected ? now : null]
  );
};

/**
 * Obtiene el estado de conexión actual
 */
export const getConnectionStatus = async (): Promise<{
  isConnected: boolean;
  phoneNumber: string | null;
  lastConnectedAt: Date | null;
}> => {
  const result = await pool.query(
    'SELECT is_connected, phone_number, last_connected_at FROM whatsapp_connection_status WHERE session_id = $1',
    [SESSION_ID]
  );
  
  if (result.rows.length === 0) {
    return { isConnected: false, phoneNumber: null, lastConnectedAt: null };
  }
  
  return {
    isConnected: result.rows[0].is_connected,
    phoneNumber: result.rows[0].phone_number,
    lastConnectedAt: result.rows[0].last_connected_at
  };
};

/**
 * Registra un mensaje enviado en el log
 */
export const logMessage = async (
  ordenId: number | null,
  phoneNumber: string,
  status: 'pending' | 'sent' | 'delivered' | 'failed',
  sentBy: number,
  errorMessage?: string
): Promise<number> => {
  const result = await pool.query(
    `INSERT INTO whatsapp_messages_log (orden_id, phone_number, message_type, status, error_message, sent_by)
     VALUES ($1, $2, 'document', $3, $4, $5)
     RETURNING id`,
    [ordenId, phoneNumber, status, errorMessage || null, sentBy]
  );
  
  return result.rows[0].id;
};

/**
 * Actualiza el estado de un mensaje en el log
 */
export const updateMessageStatus = async (
  logId: number,
  status: 'pending' | 'sent' | 'delivered' | 'failed',
  errorMessage?: string
): Promise<void> => {
  await pool.query(
    'UPDATE whatsapp_messages_log SET status = $1, error_message = $2 WHERE id = $3',
    [status, errorMessage || null, logId]
  );
};
