import { Server as SocketIOServer } from 'socket.io';

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
 * Emite un evento a todos los clientes conectados de forma segura
 */
export const emitEvent = (event: string, data?: any): void => {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
};
