/**
 * Rutas del módulo WhatsApp
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import {
  startSession,
  getStatus,
  disconnect,
  sendResults,
  getMessagesHistory
} from './whatsapp.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: WhatsApp
 *   description: Integración con WhatsApp para envío de resultados
 */

/**
 * @swagger
 * /api/whatsapp/start-session:
 *   post:
 *     summary: Inicia una nueva sesión de WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión iniciada, QR emitido por Socket.io
 */
router.post('/start-session', authenticate, startSession);

/**
 * @swagger
 * /api/whatsapp/status:
 *   get:
 *     summary: Obtiene el estado actual de la conexión de WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de conexión
 */
router.get('/status', authenticate, getStatus);

/**
 * @swagger
 * /api/whatsapp/disconnect:
 *   post:
 *     summary: Desconecta la sesión de WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada correctamente
 */
router.post('/disconnect', authenticate, disconnect);

/**
 * @swagger
 * /api/whatsapp/send-results:
 *   post:
 *     summary: Envía los resultados de una orden por WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ordenId
 *               - phoneNumber
 *             properties:
 *               ordenId:
 *                 type: integer
 *                 description: ID de la orden
 *               phoneNumber:
 *                 type: string
 *                 description: Número de teléfono (con código de país)
 *     responses:
 *       200:
 *         description: Resultados enviados correctamente
 *       400:
 *         description: Error de validación o WhatsApp no conectado
 */
router.post('/send-results', authenticate, sendResults);

/**
 * @swagger
 * /api/whatsapp/messages:
 *   get:
 *     summary: Obtiene el historial de mensajes enviados
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista de mensajes enviados
 */
router.get('/messages', authenticate, getMessagesHistory);

export default router;
