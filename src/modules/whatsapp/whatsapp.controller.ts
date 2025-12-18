/**
 * Controlador del módulo WhatsApp
 */

import { Request, Response } from 'express';
import puppeteer from 'puppeteer';
import { whatsappService } from './whatsapp.service';
import { getConnectionStatus } from './whatsapp.auth';
import pool from '../../config/database';
import { successResponse, errorResponse } from '../../utils/response.utils';

// URL del frontend para renderizar la vista previa
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Inicia una nueva sesión de WhatsApp
 * El QR se emitirá a través de Socket.io
 */
export const startSession = async (_req: Request, res: Response) => {
  try {
    await whatsappService.startSession();
    return successResponse(res, null, 'Sesión iniciada. Escanea el código QR.');
  } catch (error: any) {
    console.error('Error al iniciar sesión WhatsApp:', error);
    return errorResponse(res, error.message || 'Error al iniciar sesión de WhatsApp', 500);
  }
};

/**
 * Obtiene el estado actual de la conexión de WhatsApp
 */
export const getStatus = async (_req: Request, res: Response) => {
  try {
    // Obtener estado de la base de datos
    const dbStatus = await getConnectionStatus();
    
    // También obtener del servicio (estado en memoria más actual)
    const serviceStatus = await whatsappService.getStatus();
    
    // Combinar ambos (preferir el estado del servicio si está disponible)
    const status = {
      isConnected: serviceStatus.isConnected || dbStatus.isConnected || false,
      phoneNumber: serviceStatus.phoneNumber || dbStatus.phoneNumber || null,
      lastConnectedAt: dbStatus.lastConnectedAt || null,
    };
    
    return successResponse(res, status);
  } catch (error: any) {
    console.error('Error al obtener estado de WhatsApp:', error);
    return errorResponse(res, error.message || 'Error al obtener estado', 500);
  }
};

/**
 * Desconecta la sesión de WhatsApp
 */
export const disconnect = async (_req: Request, res: Response) => {
  try {
    await whatsappService.disconnect();
    return successResponse(res, null, 'Sesión de WhatsApp cerrada correctamente');
  } catch (error: any) {
    console.error('Error al desconectar WhatsApp:', error);
    return errorResponse(res, error.message || 'Error al desconectar', 500);
  }
};

/**
 * Envía los resultados de una orden por WhatsApp
 */
export const sendResults = async (req: Request, res: Response) => {
  try {
    const { ordenId, phoneNumber } = req.body;
    const userId = (req as any).user?.id;

    if (!ordenId || !phoneNumber) {
      return errorResponse(res, 'Se requiere ordenId y phoneNumber', 400);
    }

    // Verificar que WhatsApp esté conectado
    const status = await whatsappService.getStatus();
    if (!status.isConnected) {
      return errorResponse(res, 'WhatsApp no está conectado. Por favor vincule su cuenta primero.', 400);
    }

    // Verificar que la orden existe y obtener información
    const ordenResult = await pool.query(
      `SELECT o.*, p.nombres as paciente_nombres, p.apellido_paterno, p.apellido_materno
       FROM ordenes o
       JOIN pacientes p ON o.paciente_id = p.id
       WHERE o.id = $1`,
      [ordenId]
    );

    if (ordenResult.rows.length === 0) {
      return errorResponse(res, 'Orden no encontrada', 404);
    }

    const orden = ordenResult.rows[0];

    // Verificar que la orden está en estado válido para enviar
    if (!['APROBADA', 'IMPRESO'].includes(orden.estado)) {
      return errorResponse(res, 'Solo se pueden enviar resultados de órdenes aprobadas o impresas', 400);
    }

    // Obtener el token del header de autorización
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || '';

    // Generar PDF de resultados usando Puppeteer
    const pdfBuffer = await generateResultsPDF(ordenId, token);
    
    if (!pdfBuffer) {
      return errorResponse(res, 'Error al generar el PDF de resultados. Verifique que el frontend esté corriendo.', 500);
    }

    console.log(`📦 PDF generado, tamaño: ${pdfBuffer.length} bytes`);

    // Construir nombre del archivo
    const pacienteNombre = `${orden.paciente_nombres} ${orden.apellido_paterno}`.trim();
    const fileName = `Resultados_${pacienteNombre.replace(/\s+/g, '_')}.pdf`;

    // Construir caption
    const caption = `*Buenos tardes estimado paciente, enviamos sus resultado*\n\n` +
      `Paciente: ${pacienteNombre}\n` +
      `Muchas gracias por su preferencia!!\n\n` 

    console.log(`📲 Enviando WhatsApp a: ${phoneNumber}`);
    console.log(`📄 Archivo: ${fileName}`);

    // Enviar por WhatsApp (sendPDF maneja el logging internamente)
    const result = await whatsappService.sendPDF(
      phoneNumber, 
      pdfBuffer, 
      fileName, 
      caption,
      ordenId,
      userId
    );

    console.log(`📬 Resultado del envío:`, JSON.stringify(result));

    if (result.success) {
      return successResponse(res, { messageId: result.messageId }, 'Resultados enviados correctamente');
    } else {
      return errorResponse(res, result.error || 'Error al enviar los resultados', 500);
    }
  } catch (error: any) {
    console.error('Error al enviar resultados por WhatsApp:', error);
    return errorResponse(res, error.message || 'Error al enviar resultados', 500);
  }
};

/**
 * Obtiene el historial de mensajes enviados
 */
export const getMessagesHistory = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM whatsapp_messages_log');
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT 
        wml.*,
        o.numero_atencion,
        u.nombres as sent_by_nombre
       FROM whatsapp_messages_log wml
       LEFT JOIN ordenes o ON wml.orden_id = o.id
       LEFT JOIN usuarios u ON wml.sent_by = u.id
       ORDER BY wml.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return successResponse(res, {
      items: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Error al obtener historial de mensajes:', error);
    return errorResponse(res, error.message || 'Error al obtener historial', 500);
  }
};

/**
 * Genera el PDF de resultados de una orden usando Puppeteer
 * Renderiza la página de vista previa del frontend y la convierte a PDF
 */
async function generateResultsPDF(ordenId: number, token: string): Promise<Buffer | null> {
  let browser = null;
  
  try {
    console.log(`📄 Generando PDF para orden ${ordenId}...`);
    
    // Lanzar navegador headless
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Configurar viewport para tamaño carta
    await page.setViewport({ width: 816, height: 1056 }); // ~Letter size at 96dpi
    
    // Inyectar el token en localStorage antes de navegar
    // El frontend usa zustand persist con 'accessToken' y 'auth-storage'
    await page.evaluateOnNewDocument((authToken: string) => {
      // Token directo que usa axios
      localStorage.setItem('accessToken', authToken);
      
      // Estado de zustand persist (auth-storage)
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: { id: 1, permisos: ['results.read'] }, // Permisos mínimos necesarios
          accessToken: authToken,
          isAuthenticated: true
        },
        version: 0
      }));
    }, token);
    
    // URL de la vista previa de resultados (con token en query param como fallback)
    const url = `${FRONTEND_URL}/resultados/pdf/${ordenId}?token=${encodeURIComponent(token)}`;
    console.log(`🌐 Navegando a: ${url}`);
    
    // Navegar a la página de vista previa
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Esperar a que el contenido principal esté cargado
    // También esperar por loading-container en caso de que esté cargando
    try {
      await page.waitForSelector('.print-container', { timeout: 20000 });
    } catch {
      // Tomar screenshot para debug si falla
      const screenshot = await page.screenshot({ encoding: 'base64' });
      console.log('📸 Screenshot (base64):', screenshot.substring(0, 100) + '...');
      
      // Verificar si hay error de auth
      const pageContent = await page.content();
      if (pageContent.includes('login') || pageContent.includes('Login')) {
        console.error('❌ La página redirigió al login - problema de autenticación');
      }
      throw new Error('No se pudo cargar la vista previa de resultados');
    }
    
    // Esperar un poco más para que las imágenes carguen
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
    
    // Generar PDF
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      },
      preferCSSPageSize: true
    });
    
    console.log(`✅ PDF generado correctamente (${pdfBuffer.length} bytes)`);
    
    return Buffer.from(pdfBuffer);
    
  } catch (error: any) {
    console.error('❌ Error al generar PDF:', error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
