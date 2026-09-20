/**
 * Servicio de WhatsApp usando Baileys
 * Implementación simplificada y estable
 */

import makeWASocket, {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { Server as SocketIOServer } from 'socket.io';
import * as fs from 'fs';
import * as path from 'path';
import pool from '../../config/database';
import pino from 'pino';
import { useBaileysAuthStateDB } from './whatsapp.auth';

// Logger silencioso para Baileys
const logger = pino({ level: 'silent' });

// Directorio para credenciales locales
const AUTH_DIR = path.join(__dirname, '..', '..', '..', 'whatsapp_auth');

class WhatsAppService {
  private socket: WASocket | null = null;
  private io: SocketIOServer | null = null;
  private connectionState: string = 'disconnected';
  private phoneNumber: string | null = null;
  private isStarting: boolean = false;

  setSocketIO(io: SocketIOServer) {
    this.io = io;
  }

  getConnectionState(): string {
    return this.connectionState;
  }

  private emitStatus(state: string, data?: any) {
    this.connectionState = state;
    if (this.io) {
      this.io.emit('whatsapp:status', { state, ...data });
    }
    console.log(`📱 WhatsApp status: ${state}`, data || '');
  }

  async startSession(): Promise<void> {
    // Evitar múltiples inicios simultáneos
    if (this.isStarting) {
      console.log('⚠️ Ya hay un inicio de sesión en progreso');
      throw new Error('Ya hay un inicio de sesión en progreso');
    }

    // Si ya está conectado, emitir estado y retornar
    if (this.connectionState === 'connected' && this.socket) {
      console.log('✅ WhatsApp ya está conectado');
      this.emitStatus('connected', { phoneNumber: this.phoneNumber });
      return;
    }

    this.isStarting = true;
    console.log('🚀 Iniciando sesión de WhatsApp...');

    try {
      // Desconectar sesión anterior si existe
      await this.cleanupSession();

      // Obtener estado de autenticación desde PostgreSQL
      const { state, saveCreds } = await useBaileysAuthStateDB();

      // Obtener última versión de Baileys
      const { version } = await fetchLatestBaileysVersion();
      console.log(`📦 Usando versión de Baileys: ${version.join('.')}`);

      // Crear socket de WhatsApp
      this.socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
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

      // Manejar actualizaciones de conexión
      this.socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        // Emitir QR si está disponible
        if (qr) {
          console.log('📱 Nuevo código QR generado');
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

          // Solo reconectar en casos específicos
          if (statusCode === DisconnectReason.loggedOut) {
            // Usuario cerró sesión, limpiar credenciales
            console.log('🚪 Usuario cerró sesión, limpiando credenciales...');
            await this.clearCredentials();
            this.emitStatus('disconnected', { reason: 'logged_out' });
          } else if (statusCode === DisconnectReason.restartRequired) {
            // Reinicio requerido, intentar reconectar después de un delay
            console.log('🔄 Reinicio requerido, reconectando en 5 segundos...');
            this.emitStatus('disconnected', { reason: 'restart_required' });
            setTimeout(() => this.tryReconnect(), 5000);
          } else if (statusCode === 515) {
            // Stream Errored - no reconectar automáticamente, emitir error
            console.log('⚠️ Error 515 - Stream Errored. Limpiando sesión...');
            await this.clearCredentials();
            this.emitStatus('auth_error', { 
              reason: 'stream_error',
              message: 'Error de conexión. Por favor, intenta vincular nuevamente.'
            });
          } else {
            this.emitStatus('disconnected', { reason, statusCode });
          }
        }

        if (connection === 'open') {
          console.log('✅ WhatsApp conectado exitosamente!');
          this.isStarting = false;
          
          // Obtener info del usuario
          const user = this.socket?.user;
          this.phoneNumber = user?.id?.split(':')[0] || null;
          
          // Guardar estado en BD
          await this.saveConnectionStatus(true);
          
          this.emitStatus('connected', { phoneNumber: this.phoneNumber });
        }
      });

      // Guardar credenciales cuando se actualicen
      this.socket.ev.on('creds.update', saveCreds);

    } catch (error: any) {
      console.error('❌ Error al iniciar sesión:', error);
      this.isStarting = false;
      this.emitStatus('error', { error: error.message });
      throw error;
    }
  }

  async tryReconnect(): Promise<void> {
    // Verificar si hay credenciales en BD
    try {
      const result = await pool.query(
        "SELECT 1 FROM whatsapp_sessions WHERE session_id = 'default' AND data_key = 'creds' LIMIT 1"
      );
      if (result.rows.length === 0) {
        console.log('ℹ️ No hay credenciales en BD para reconectar');
        return;
      }
    } catch {
      console.log('ℹ️ No se pudo verificar credenciales en BD');
      return;
    }

    // Si ya está conectado o iniciando, no hacer nada
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
      // El socket puede quedar null si logout() disparó connection.update
      if (this.socket) {
        this.socket.end(undefined);
        this.socket = null;
      }
    }

    await this.clearCredentials();
    this.emitStatus('disconnected');
  }

  private async clearCredentials(): Promise<void> {
    // Limpiar auth state y estado de conexión en BD
    try {
      await pool.query("DELETE FROM whatsapp_sessions WHERE session_id = 'default'");
      await pool.query(`
        UPDATE whatsapp_connection_status 
        SET is_connected = false, last_disconnected_at = NOW(), updated_at = NOW()
        WHERE is_connected = true
      `);
      console.log('🗑️ Credenciales eliminadas de BD');
    } catch (e) {
      console.error('Error al limpiar BD:', e);
    }

    this.phoneNumber = null;
    this.connectionState = 'disconnected';
  }

  private async saveConnectionStatus(isConnected: boolean): Promise<void> {
    try {
      if (isConnected && this.phoneNumber) {
        await pool.query(`
          INSERT INTO whatsapp_connection_status (session_id, is_connected, phone_number, last_connected_at)
          VALUES ('default', true, $1, NOW())
          ON CONFLICT (session_id)
          DO UPDATE SET is_connected = true, phone_number = $1, last_connected_at = NOW(), last_disconnected_at = NULL, updated_at = NOW()
        `, [this.phoneNumber]);
      } else {
        await pool.query(`
          INSERT INTO whatsapp_connection_status (session_id, is_connected, last_disconnected_at)
          VALUES ('default', false, NOW())
          ON CONFLICT (session_id)
          DO UPDATE SET is_connected = false, last_disconnected_at = NOW(), updated_at = NOW()
        `);
      }
    } catch (e) {
      console.error('Error al guardar estado de conexión:', e);
    }
  }

  async getStatus(): Promise<{ isConnected: boolean; phoneNumber: string | null }> {
    return {
      isConnected: this.connectionState === 'connected',
      phoneNumber: this.phoneNumber
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

    // Formatear número (asegurar formato correcto)
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
        caption: caption || ''
      });

      const messageId = result?.key?.id || undefined;
      console.log('✅ PDF enviado exitosamente, messageId:', messageId);

      // Registrar en log si tenemos ordenId
      if (ordenId) {
        try {
          await pool.query(`
            INSERT INTO whatsapp_messages_log 
            (orden_id, phone_number, message_type, status, message_id, sent_by, created_at)
            VALUES ($1, $2, 'pdf', 'sent', $3, $4, NOW())
          `, [ordenId, phoneNumber, messageId, userId || null]);
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

// Singleton
export const whatsappService = new WhatsAppService();
