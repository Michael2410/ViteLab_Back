import { Server as SocketIOServer } from 'socket.io';
import { tenantStorage } from '../db/tenant-context';

let ioInstance: SocketIOServer | null = null;

/**
 * Inicializa la instancia global de Socket.IO
 */
export const setSocketIO = (io: SocketIOServer): void => {
  ioInstance = io;
};

/**
 * Obtiene la instancia global de Socket.IO
 */
export const getSocketIO = (): SocketIOServer | null => {
  return ioInstance;
};

/**
 * Emite un evento a los clientes conectados de forma segura.
 * Si se ejecuta dentro del contexto de un tenant, emite exclusivamente
 * a la sala 'tenant:${tenantId}' evitando cualquier fuga cross-tenant.
 */
export const emitEvent = (event: string, data?: any, targetTenantId?: string): void => {
  if (!ioInstance) return;

  const currentTenantId = targetTenantId || tenantStorage.getStore()?.tenantId;
  if (currentTenantId) {
    ioInstance.to(`tenant:${currentTenantId}`).emit(event, data);
  } else {
    ioInstance.emit(event, data);
  }
};
