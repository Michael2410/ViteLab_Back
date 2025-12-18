/**
 * Tipos para el módulo de WhatsApp
 */

export interface WhatsAppStatus {
  isConnected: boolean;
  phoneNumber: string | null;
  lastConnectedAt: Date | null;
}

export interface SendMessagePayload {
  ordenId: number;
  phoneNumber: string;
}

export interface SendMessageResponse {
  success: boolean;
  message: string;
  messageId?: string;
}

export interface QRCodeData {
  qr: string;
  timestamp: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'qr';
