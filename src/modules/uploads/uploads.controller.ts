import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { successResponse, errorResponse } from '../../utils/response.utils';
import { tenantStorage } from '../../db/tenant-context';
import { generateSignedFileToken, verifySignedFileToken } from '../../utils/file-token.utils';

// Crear carpeta base de uploads si no existe
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de multer con partición estricta por tenant
const storage = multer.diskStorage({
  destination: (req: any, _file: any, cb: any) => {
    const tenantId = req.user?.tenantId || tenantStorage.getStore()?.tenantId || 'vitelab_central';
    const type = req.params?.type || 'general';
    const tenantTypeDir = path.join(uploadDir, 'tenants', tenantId, type);
    if (!fs.existsSync(tenantTypeDir)) {
      fs.mkdirSync(tenantTypeDir, { recursive: true });
    }
    cb(null, tenantTypeDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueId = `${Date.now()}-${randomUUID()}`;
    cb(null, `${uniqueId}${ext}`);
  },
});

const fileFilter = (_req: any, file: any, cb: any) => {
  // Aceptar solo imágenes y PDFs
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp) y documentos PDF'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
});

export class UploadsController {
  /**
   * Sube un archivo particionado en el directorio del tenant correspondiente
   */
  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const file = (req as any).file;
      if (!file) {
        errorResponse(res, 'No se proporcionó ningún archivo', null, 400);
        return;
      }

      const tenantId = req.user?.tenantId || tenantStorage.getStore()?.tenantId || 'vitelab_central';
      const type = req.params.type || 'general';
      const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;

      // Generar token firmado HMAC para que etiquetas <img> puedan cargarlo de forma segura
      const signedToken = generateSignedFileToken(tenantId, type, file.filename, 86400 * 30);
      const fileUrl = `${baseUrl}/uploads/${type}/${file.filename}?tenant=${tenantId}&token=${signedToken}`;

      successResponse(
        res,
        {
          url: fileUrl,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          tenantId,
        },
        'Archivo subido exitosamente'
      );
    } catch (error) {
      console.error('Error uploading file:', error);
      errorResponse(res, 'Error al subir el archivo', null, 500);
    }
  }

  /**
   * Sirve un archivo de forma segura y aislada por tenant.
   * Valida autenticación por JWT o token firmado HMAC, y previene Path Traversal.
   */
  async serveFile(req: Request, res: Response): Promise<void> {
    try {
      const { type, filename } = req.params;
      const signedToken = req.query.token as string | undefined;
      const queryTenant = req.query.tenant as string | undefined;

      // 1. Determinar tenant solicitante
      let tenantId: string | null = req.user?.tenantId || tenantStorage.getStore()?.tenantId || null;

      // Si no viene en sesión, verificar token firmado HMAC
      if (!tenantId && signedToken && queryTenant) {
        const isValid = verifySignedFileToken(queryTenant, type, filename, signedToken);
        if (isValid) {
          tenantId = queryTenant;
        }
      }

      // Si aún no hay tenant y es una petición con token Bearer en header Authorization
      if (!tenantId) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
          try {
            const decoded = jwt.verify(
              token,
              process.env.JWT_ACCESS_SECRET || 'access_secret'
            ) as any;
            tenantId = decoded.tenantId || decoded.tenantSlug || 'vitelab_central';
          } catch {}
        }
      }

      // Si no hay credenciales ni token firmado, rechazar con 401
      if (!tenantId) {
        // Verificación de fallback para compatibilidad con datos legacy de vitelab_central
        const legacyPath = path.resolve(uploadDir, type, filename);
        const legacyAllowed = path.resolve(uploadDir, type);
        if (legacyPath.startsWith(legacyAllowed) && fs.existsSync(legacyPath)) {
          tenantId = 'vitelab_central';
        } else {
          res.status(401).json({
            success: false,
            message: 'Acceso no autorizado al archivo clínico. Inicie sesión o proporcione un enlace firmado.',
          });
          return;
        }
      }

      // 2. Comprobación estricta contra Path Traversal
      const tenantBaseDir = path.resolve(uploadDir, 'tenants', tenantId, type);
      const targetFilePath = path.resolve(tenantBaseDir, filename);

      if (!targetFilePath.startsWith(tenantBaseDir)) {
        res.status(403).json({
          success: false,
          message: 'Acceso denegado: Path traversal detectado',
        });
        return;
      }

      // 3. Verificar existencia en la carpeta del tenant o fallback legacy de vitelab_central
      let finalPath = targetFilePath;
      if (!fs.existsSync(finalPath)) {
        if (tenantId === 'vitelab_central') {
          const legacyFallback = path.resolve(uploadDir, type, filename);
          const legacyBase = path.resolve(uploadDir, type);
          if (legacyFallback.startsWith(legacyBase) && fs.existsSync(legacyFallback)) {
            finalPath = legacyFallback;
          } else {
            res.status(404).json({ success: false, message: 'Archivo no encontrado' });
            return;
          }
        } else {
          res.status(404).json({
            success: false,
            message: 'Archivo no encontrado en este laboratorio clínico',
          });
          return;
        }
      }

      // 4. Servir archivo con cabeceras de seguridad
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.sendFile(finalPath);
    } catch (error) {
      console.error('Error al servir archivo:', error);
      res.status(500).json({ success: false, message: 'Error interno al servir archivo' });
    }
  }

  /**
   * Genera una URL firmada HMAC temporal para previsualización segura
   */
  async getSignedUrl(req: Request, res: Response): Promise<void> {
    try {
      const { type, filename } = req.params;
      const tenantId = req.user?.tenantId || tenantStorage.getStore()?.tenantId || 'vitelab_central';
      const expiresIn = parseInt((req.query.expiresIn as string) || '300', 10);

      const token = generateSignedFileToken(tenantId, type, filename, expiresIn);
      const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
      const signedUrl = `${baseUrl}/uploads/${type}/${filename}?tenant=${tenantId}&token=${token}`;

      successResponse(res, { signedUrl, expiresIn }, 'URL firmada generada exitosamente');
    } catch (error) {
      console.error('Error al generar URL firmada:', error);
      errorResponse(res, 'Error al generar URL firmada', null, 500);
    }
  }

  /**
   * Elimina un archivo perteneciente exclusivamente al tenant autenticado
   */
  async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const { type, filename } = req.params;
      const tenantId = req.user?.tenantId || tenantStorage.getStore()?.tenantId || 'vitelab_central';
      const tenantBaseDir = path.resolve(uploadDir, 'tenants', tenantId, type);
      const targetPath = path.resolve(tenantBaseDir, filename);

      if (!targetPath.startsWith(tenantBaseDir)) {
        errorResponse(res, 'Path traversal detectado', null, 403);
        return;
      }

      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        successResponse(res, null, 'Archivo eliminado exitosamente');
        return;
      }

      // Fallback legacy para vitelab_central
      if (tenantId === 'vitelab_central') {
        const legacyPath = path.resolve(uploadDir, type, filename);
        const legacyBase = path.resolve(uploadDir, type);
        if (legacyPath.startsWith(legacyBase) && fs.existsSync(legacyPath)) {
          fs.unlinkSync(legacyPath);
          successResponse(res, null, 'Archivo eliminado exitosamente');
          return;
        }
      }

      errorResponse(res, 'Archivo no encontrado', null, 404);
    } catch (error) {
      console.error('Error deleting file:', error);
      errorResponse(res, 'Error al eliminar el archivo', null, 500);
    }
  }
}

export const uploadsController = new UploadsController();
