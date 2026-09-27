/**
 * Adaptador de Auth State para Baileys usando PostgreSQL y Drizzle ORM
 */

import {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
  initAuthCreds,
  proto,
  BufferJSON,
} from '@whiskeysockets/baileys';
import { eq, and, sql } from 'drizzle-orm';
import { db, whatsappSessions, whatsappConnectionStatus, whatsappMessagesLog } from '../../../db';

const SESSION_ID = 'default';

/**
 * Guarda un valor en la BD
 */
const saveData = async (key: string, value: unknown): Promise<void> => {
  const serialized = JSON.stringify(value, BufferJSON.replacer);

  await db
    .insert(whatsappSessions)
    .values({
      session_id: SESSION_ID,
      data_key: key,
      data_value: serialized,
    })
    .onConflictDoUpdate({
      target: [whatsappSessions.data_key, whatsappSessions.session_id],
      set: {
        data_value: serialized,
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      },
    });
};

/**
 * Obtiene un valor de la BD
 */
const getData = async <T>(key: string): Promise<T | null> => {
  const [row] = await db
    .select({ data_value: whatsappSessions.data_value })
    .from(whatsappSessions)
    .where(and(eq(whatsappSessions.session_id, SESSION_ID), eq(whatsappSessions.data_key, key)));

  if (!row || !row.data_value) {
    return null;
  }

  return JSON.parse(row.data_value, BufferJSON.reviver);
};

/**
 * Elimina un valor de la BD
 */
const removeData = async (key: string): Promise<void> => {
  await db
    .delete(whatsappSessions)
    .where(and(eq(whatsappSessions.session_id, SESSION_ID), eq(whatsappSessions.data_key, key)));
};

/**
 * Elimina múltiples valores que coincidan con un patrón
 */
export const removeDataByPrefix = async (prefix: string): Promise<void> => {
  await db
    .delete(whatsappSessions)
    .where(
      and(
        eq(whatsappSessions.session_id, SESSION_ID),
        sql`${whatsappSessions.data_key} LIKE ${`${prefix}%`}`
      )
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
  let creds: AuthenticationCreds = (await getData<AuthenticationCreds>('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[]
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};

          for (const id of ids) {
            const key = `${type}-${id}`;
            const value = await getData<SignalDataTypeMap[T]>(key);
            if (value) {
              if (type === 'app-state-sync-key' && value) {
                data[id] = proto.Message.AppStateSyncKeyData.fromObject(
                  value as object
                ) as unknown as SignalDataTypeMap[T];
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
        },
      },
    },
    saveCreds: async (): Promise<void> => {
      await saveData('creds', creds);
    },
    clearState: async (): Promise<void> => {
      await db.delete(whatsappSessions).where(eq(whatsappSessions.session_id, SESSION_ID));
    },
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

  await db
    .insert(whatsappConnectionStatus)
    .values({
      session_id: SESSION_ID,
      is_connected: isConnected,
      phone_number: phoneNumber || null,
      last_connected_at: isConnected ? (now as any) : null,
      last_disconnected_at: !isConnected ? (now as any) : null,
    })
    .onConflictDoUpdate({
      target: whatsappConnectionStatus.session_id,
      set: {
        is_connected: isConnected,
        phone_number: phoneNumber ? phoneNumber : sql`whatsapp_connection_status.phone_number`,
        last_connected_at: isConnected
          ? (now as any)
          : sql`whatsapp_connection_status.last_connected_at`,
        last_disconnected_at: !isConnected
          ? (now as any)
          : sql`whatsapp_connection_status.last_disconnected_at`,
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      },
    });
};

/**
 * Obtiene el estado de conexión actual
 */
export const getConnectionStatus = async (): Promise<{
  isConnected: boolean;
  phoneNumber: string | null;
  lastConnectedAt: Date | null;
}> => {
  const [row] = await db
    .select()
    .from(whatsappConnectionStatus)
    .where(eq(whatsappConnectionStatus.session_id, SESSION_ID));

  if (!row) {
    return { isConnected: false, phoneNumber: null, lastConnectedAt: null };
  }

  return {
    isConnected: Boolean(row.is_connected),
    phoneNumber: row.phone_number,
    lastConnectedAt: row.last_connected_at ? new Date(row.last_connected_at) : null,
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
  const [row] = await db
    .insert(whatsappMessagesLog)
    .values({
      orden_id: ordenId || null,
      phone_number: phoneNumber,
      message_type: 'document',
      status,
      error_message: errorMessage || null,
      sent_by: sentBy,
    })
    .returning({ id: whatsappMessagesLog.id });

  return row.id;
};

/**
 * Actualiza el estado de un mensaje en el log
 */
export const updateMessageStatus = async (
  logId: number,
  status: 'pending' | 'sent' | 'delivered' | 'failed',
  errorMessage?: string
): Promise<void> => {
  await db
    .update(whatsappMessagesLog)
    .set({
      status,
      error_message: errorMessage || null,
    })
    .where(eq(whatsappMessagesLog.id, logId));
};
