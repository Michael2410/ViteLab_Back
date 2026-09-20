import { Router } from 'express';
import { uploadsController, upload } from './uploads.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Subir un archivo (logo, firma, etc)
router.post('/:type', upload.single('file'), uploadsController.uploadFile.bind(uploadsController));

// Eliminar un archivo
router.delete('/:type/:filename', uploadsController.deleteFile.bind(uploadsController));

export default router;
