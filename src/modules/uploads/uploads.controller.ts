import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { successResponse, errorResponse } from '../../utils/response.utils';

// Crear carpeta uploads si no existe
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de multer
const storage = multer.diskStorage({
  destination: (req: any, _file: any, cb: any) => {
    const type = req.params?.type || 'general';
    const typeDir = path.join(uploadDir, type);
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    cb(null, typeDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (_req: any, file: any, cb: any) => {
  // Aceptar solo imágenes
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (jpeg, jpg, png, gif, webp)'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  }
});

export class UploadsController {
  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const file = (req as any).file;
      if (!file) {
        errorResponse(res, 'No se proporcionó ningún archivo', null, 400);
        return;
      }

      const type = req.params.type || 'general';
      const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
      const fileUrl = `${baseUrl}/uploads/${type}/${file.filename}`;

      successResponse(res, {
        url: fileUrl,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }, 'Archivo subido exitosamente');
    } catch (error) {
      console.error('Error uploading file:', error);
      errorResponse(res, 'Error al subir el archivo', null, 500);
    }
  }

  async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const { type, filename } = req.params;
      const filePath = path.join(uploadDir, type, filename);

      if (!fs.existsSync(filePath)) {
        errorResponse(res, 'Archivo no encontrado', null, 404);
        return;
      }

      fs.unlinkSync(filePath);
      successResponse(res, null, 'Archivo eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting file:', error);
      errorResponse(res, 'Error al eliminar el archivo', null, 500);
    }
  }
}

export const uploadsController = new UploadsController();
