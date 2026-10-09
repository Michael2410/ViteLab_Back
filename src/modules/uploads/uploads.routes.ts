import { Router } from 'express';
import { uploadsController, upload } from './uploads.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Subir un archivo particionado por tenant - Requiere autenticación
router.post(
  '/:type',
  authenticate,
  upload.single('file'),
  uploadsController.uploadFile.bind(uploadsController)
);

// Generar URL firmada temporal para etiquetas <img> / visores - Requiere autenticación
router.get(
  '/sign/:type/:filename',
  authenticate,
  uploadsController.getSignedUrl.bind(uploadsController)
);

// Eliminar un archivo perteneciente al tenant - Requiere autenticación
router.delete(
  '/:type/:filename',
  authenticate,
  uploadsController.deleteFile.bind(uploadsController)
);

// Servir un archivo (valida JWT o token firmado HMAC internamente sin requerir login en <img src>)
router.get('/:type/:filename', uploadsController.serveFile.bind(uploadsController));

export default router;
