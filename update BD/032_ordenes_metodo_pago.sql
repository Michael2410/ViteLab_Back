-- Migración 032: Agregar columna metodo_pago a la tabla ordenes
-- Métodos soportados: EFECTIVO, YAPE, PLIN, TARJETA, TRANSFERENCIA

ALTER TABLE ordenes 
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(30) DEFAULT 'EFECTIVO' NOT NULL;

-- Índice para optimizar consultas de cuadre de caja y reportes
CREATE INDEX IF NOT EXISTS idx_ordenes_metodo_pago ON ordenes(metodo_pago);
