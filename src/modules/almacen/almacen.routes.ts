import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import { productosRouter } from './productos';
import { proveedoresRouter } from './proveedores';
import { maestrosRouter } from './maestros';
import { ingresosRouter } from './ingresos';
import { stockRouter } from './stock';
import { despachosRouter } from './despachos';
import { custodiaRouter } from './custodia';
import { consumosRouter } from './consumos';
import { pedidosRouter } from './pedidos';
import { transferenciasRouter } from './transferencias';
import { ajustesRouter } from './ajustes';
import { almacenErrorHandler } from './shared/almacen.error-handler';

const router = Router();

// Todas las rutas de almacén requieren token JWT autenticado
router.use(authenticateToken);

router.use('/productos', productosRouter);
router.use('/proveedores', proveedoresRouter);
router.use('/maestros', maestrosRouter);
router.use('/ingresos', ingresosRouter);
router.use('/stock', stockRouter);
router.use('/despachos', despachosRouter);
router.use('/custodia', custodiaRouter);
router.use('/consumos', consumosRouter);
router.use('/pedidos', pedidosRouter);
router.use('/transferencias', transferenciasRouter);
router.use('/ajustes', ajustesRouter);

// Manejador centralizado de errores para todo el módulo almacén
router.use(almacenErrorHandler);

export default router;
