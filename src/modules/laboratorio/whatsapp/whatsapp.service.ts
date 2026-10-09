/**
 * Servicio de WhatsApp usando Baileys y Drizzle ORM
 */

import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { Server as SocketIOServer } from 'socket.io';
import pino from 'pino';
import { eq, and, sql } from 'drizzle-orm';
import { db, whatsappSessions, whatsappConnectionStatus, whatsappMessagesLog, tenantStorage, runInTenant } from '../../../db';
import { useBaileysAuthStateDB } from './whatsapp.auth';

const logger = pino({ level: 'silent' });

class WhatsAppService {
  private socket: WASocket | null = null;
  private io: SocketIOServer | null = null;
  private connectionState: string = 'disconnected';
  private phoneNumber: string | null = null;
  private isStarting: boolean = false;
  private currentQr: string | null = null;

  private async runWithTenantContext<T>(fn: () => Promise<T>): Promise<T> {
    if (tenantStorage.getStore()) {
      return fn();
    }
    return runInTenant('vitelab_central', { kind: 'system', job: 'whatsapp:service' }, fn);
  }

  setSocketIO(io: SocketIOServer) {
    this.io = io;
  }

  getConnectionState(): string {
    return this.connectionState;
  }

  private emitStatus(state: string, data?: any, targetTenantId?: string) {
    this.connectionState = state;
    if (state === 'qr' && data?.qr) {
      this.currentQr = data.qr;
    } else if (state === 'connected' || state === 'disconnected') {
      this.currentQr = null;
    }

    const tenantId = targetTenantId || tenantStorage.getStore()?.tenantId || 'vitelab_central';
    if (this.io) {
      // Emitir a la sala del tenant
      this.io.to(`tenant:${tenantId}`).emit('whatsapp:status', { state, ...data });
      // Emitir también a vitelab_central para asegurar recepción en salas fallback
      if (tenantId !== 'vitelab_central') {
        this.io.to('tenant:vitelab_central').emit('whatsapp:status', { state, ...data });
      }
      // Re-emitir evento directo whatsapp:qr si corresponde
      if (state === 'qr' && data?.qr) {
        this.io.to(`tenant:${tenantId}`).emit('whatsapp:qr', { qr: data.qr });
        if (tenantId !== 'vitelab_central') {
          this.io.to('tenant:vitelab_central').emit('whatsapp:qr', { qr: data.qr });
        }
      }
    }
    console.log(`📱 WhatsApp status [tenant:${tenantId}]: ${state}`, state === 'qr' ? '{ qr: [GENERADO] }' : (data || ''));
  }

  async startSession(): Promise<void> {
    if (this.connectionState === 'connected' && this.socket) {
      console.log('✅ WhatsApp ya está conectado');
      this.emitStatus('connected', { phoneNumber: this.phoneNumber });
      return;
    }

    if (this.connectionState === 'qr' && this.currentQr && this.socket) {
      console.log('📱 WhatsApp ya tiene un código QR activo, re-emitiendo...');
      this.emitStatus('qr', { qr: this.currentQr });
      return;
    }

    if (this.isStarting) {
      console.log('ℹ️ Ya hay un inicio de sesión en progreso. Esperando conexión/QR...');
      if (this.currentQr) {
        this.emitStatus('qr', { qr: this.currentQr });
      }
      return;
    }

    this.isStarting = true;
    console.log('🚀 Iniciando sesión de WhatsApp...');

    try {
      await this.cleanupSession();

      const { state, saveCreds } = await useBaileysAuthStateDB();
      const { version } = await fetchLatestBaileysVersion();
      console.log(`📦 Usando versión de Baileys: ${version.join('.')}`);

      this.socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: true,
        logger,
        browser: ['ViteLab LIMS', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        qrTimeout: 60000,
        defaultQueryTimeoutMs: 60000,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
      });

      this.socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('📱 Nuevo código QR generado');
          this.isStarting = false;
          this.currentQr = qr;
          this.emitStatus('qr', { qr });
        }

        if (connection === 'connecting') {
          this.emitStatus('connecting');
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const reason = DisconnectReason[statusCode] || `Unknown (${statusCode})`;
          console.log(`❌ Conexión cerrada. Razón: ${reason}, Código: ${statusCode}`);

          this.socket = null;
          this.isStarting = false;

          if (statusCode === DisconnectReason.loggedOut) {
            console.log('🚪 Usuario cerró sesión, limpiando credenciales...');
            await this.clearCredentials();
            this.emitStatus('disconnected', { reason: 'logged_out' });
          } else if (statusCode === DisconnectReason.restartRequired) {
            console.log('🔄 Reinicio requerido, reconectando en 5 segundos...');
            this.emitStatus('disconnected', { reason: 'restart_required' });
            setTimeout(() => this.tryReconnect(), 5000);
          } else if (statusCode === 515) {
            console.log('⚠️ Error 515 - Stream Errored. Limpiando sesión...');
            await this.clearCredentials();
            this.emitStatus('auth_error', {
              reason: 'stream_error',
              message: 'Error de conexión. Por favor, intenta vincular nuevamente.',
            });
          } else {
            this.emitStatus('disconnected', { reason, statusCode });
          }
        }

        if (connection === 'open') {
          console.log('✅ WhatsApp conectado exitosamente!');
          this.isStarting = false;
          this.currentQr = null;

          const user = this.socket?.user;
          this.phoneNumber = user?.id?.split(':')[0] || null;

          await this.saveConnectionStatus(true);
          this.emitStatus('connected', { phoneNumber: this.phoneNumber });
        }
      });

      this.socket.ev.on('creds.update', saveCreds);
    } catch (error: any) {
      console.error('❌ Error al iniciar sesión:', error);
      this.isStarting = false;
      this.emitStatus('error', { error: error.message });
      throw error;
    }
  }

  async tryReconnect(): Promise<void> {
    return this.runWithTenantContext(async () => {
      try {
        const rows = await db
          .select({ id: whatsappSessions.id })
          .from(whatsappSessions)
          .where(
            and(eq(whatsappSessions.session_id, 'default'), eq(whatsappSessions.data_key, 'creds'))
          )
          .limit(1);

        if (rows.length === 0) {
          console.log('ℹ️ No hay credenciales en BD para reconectar');
          return;
        }
      } catch {
        console.log('ℹ️ No se pudo verificar credenciales en BD');
        return;
      }

      if (this.connectionState === 'connected' || this.isStarting) {
        console.log('ℹ️ Ya conectado o iniciando sesión');
        return;
      }

      console.log('🔄 Intentando reconectar con credenciales guardadas...');
      try {
        await this.startSession();
      } catch (error) {
        console.log('⚠️ Error al reconectar:', error);
      }
    });
  }

  private async cleanupSession(): Promise<void> {
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        await this.socket.logout().catch(() => {});
        this.socket.end(undefined);
      } catch (e) {
        // Ignorar errores de limpieza
      }
      this.socket = null;
    }
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Desconectando WhatsApp...');

    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (e) {
        // Ignorar
      }
      if (this.socket) {
        this.socket.end(undefined);
        this.socket = null;
      }
    }

    await this.clearCredentials();
    this.currentQr = null;
    this.isStarting = false;
    this.emitStatus('disconnected');
  }

  private async clearCredentials(): Promise<void> {
    return this.runWithTenantContext(async () => {
      try {
        await db.delete(whatsappSessions).where(eq(whatsappSessions.session_id, 'default'));
        await db
          .update(whatsappConnectionStatus)
          .set({
            is_connected: false,
            last_disconnected_at: sql`CURRENT_TIMESTAMP` as any,
            updated_at: sql`CURRENT_TIMESTAMP` as any,
          })
          .where(eq(whatsappConnectionStatus.is_connected, true));
        console.log('🗑️ Credenciales eliminadas de BD');
      } catch (e) {
        console.error('Error al limpiar BD:', e);
      }

      this.phoneNumber = null;
      this.connectionState = 'disconnected';
    });
  }

  private async saveConnectionStatus(isConnected: boolean): Promise<void> {
    return this.runWithTenantContext(async () => {
      try {
        if (isConnected && this.phoneNumber) {
          await db
            .insert(whatsappConnectionStatus)
            .values({
              session_id: 'default',
              is_connected: true,
              phone_number: this.phoneNumber,
              last_connected_at: sql`CURRENT_TIMESTAMP` as any,
            })
            .onConflictDoUpdate({
              target: whatsappConnectionStatus.session_id,
              set: {
                is_connected: true,
                phone_number: this.phoneNumber,
                last_connected_at: sql`CURRENT_TIMESTAMP` as any,
                last_disconnected_at: null,
                updated_at: sql`CURRENT_TIMESTAMP` as any,
              },
            });
        } else {
          await db
            .insert(whatsappConnectionStatus)
            .values({
              session_id: 'default',
              is_connected: false,
              last_disconnected_at: sql`CURRENT_TIMESTAMP` as any,
            })
            .onConflictDoUpdate({
              target: whatsappConnectionStatus.session_id,
              set: {
                is_connected: false,
                last_disconnected_at: sql`CURRENT_TIMESTAMP` as any,
                updated_at: sql`CURRENT_TIMESTAMP` as any,
              },
            });
        }
      } catch (e) {
        console.error('Error al guardar estado de conexión:', e);
      }
    });
  }

  async getStatus(): Promise<{ isConnected: boolean; phoneNumber: string | null; qr?: string | null; state: string }> {
    return {
      isConnected: this.connectionState === 'connected',
      phoneNumber: this.phoneNumber,
      qr: this.connectionState === 'qr' ? this.currentQr : null,
      state: this.connectionState,
    };
  }

  async sendPDF(
    phoneNumber: string,
    pdfBuffer: Buffer,
    filename: string,
    caption?: string,
    ordenId?: number,
    userId?: number
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.socket || this.connectionState !== 'connected') {
      return { success: false, error: 'WhatsApp no está conectado' };
    }

    let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (!formattedNumber.endsWith('@s.whatsapp.net')) {
      formattedNumber = `${formattedNumber}@s.whatsapp.net`;
    }

    console.log(`📤 Enviando PDF a ${formattedNumber}...`);

    try {
      const result = await this.socket.sendMessage(formattedNumber, {
        document: pdfBuffer,
        mimetype: 'application/pdf',
        fileName: filename,
        caption: caption || '',
      });

      const messageId = result?.key?.id || undefined;
      console.log('✅ PDF enviado exitosamente, messageId:', messageId);

      if (ordenId) {
        try {
          await db.insert(whatsappMessagesLog).values({
            orden_id: ordenId,
            phone_number: phoneNumber,
            message_type: 'pdf',
            status: 'sent',
            message_id: messageId,
            sent_by: userId || null,
          });
        } catch (logError) {
          console.error('Error al registrar log de mensaje:', logError);
        }
      }

      return { success: true, messageId };
    } catch (error: any) {
      console.error('❌ Error al enviar PDF:', error);
      return { success: false, error: error.message || 'Error al enviar PDF' };
    }
  }

  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.socket || this.connectionState !== 'connected') {
      throw new Error('WhatsApp no está conectado');
    }

    let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (!formattedNumber.endsWith('@s.whatsapp.net')) {
      formattedNumber = `${formattedNumber}@s.whatsapp.net`;
    }

    try {
      await this.socket.sendMessage(formattedNumber, { text: message });
      return true;
    } catch (error: any) {
      console.error('❌ Error al enviar mensaje:', error);
      throw error;
    }
  }
}

export const whatsappService = new WhatsAppService();
