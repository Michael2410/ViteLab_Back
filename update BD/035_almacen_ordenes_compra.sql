-- ============================================================
-- MIGRACIÓN 035: Órdenes de Compra y Recepción en Almacén
-- Depende de: 026_almacen_stock_ingresos_kardex.sql
-- Idempotente: puede ejecutarse más de una vez sin error
-- ============================================================
BEGIN;

-- 1. ÓRDENES DE COMPRA
CREATE TABLE IF NOT EXISTS almacen.ordenes_compra (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    sede_id INTEGER NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
    proveedor_id INTEGER NOT NULL REFERENCES almacen.proveedores(id) ON DELETE RESTRICT,
    almacen_destino_id INTEGER REFERENCES almacen.almacenes(id) ON DELETE SET NULL,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_entrega_esperada DATE,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',
    condicion_pago VARCHAR(50) DEFAULT 'CONTADO',
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    subtotal NUMERIC(14, 4) NOT NULL DEFAULT 0,
    igv NUMERIC(14, 4) NOT NULL DEFAULT 0,
    total NUMERIC(14, 4) NOT NULL DEFAULT 0,
    observaciones TEXT,
    motivo_anulacion TEXT,
    usuario_registro_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    usuario_anulacion_id INTEGER REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    fecha_anulacion TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ordenes_compra_estado_check CHECK (estado IN ('PENDIENTE', 'PARCIAL', 'RECEPCIONADA', 'ANULADA'))
);

CREATE INDEX IF NOT EXISTS idx_alm_oc_sede ON almacen.ordenes_compra(sede_id);
CREATE INDEX IF NOT EXISTS idx_alm_oc_proveedor ON almacen.ordenes_compra(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_alm_oc_estado ON almacen.ordenes_compra(estado);
CREATE INDEX IF NOT EXISTS idx_alm_oc_fecha ON almacen.ordenes_compra(fecha_emision);

-- 2. ORDEN DE COMPRA DETALLE
CREATE TABLE IF NOT EXISTS almacen.orden_compra_detalle (
    id SERIAL PRIMARY KEY,
    orden_compra_id INTEGER NOT NULL REFERENCES almacen.ordenes_compra(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id) ON DELETE RESTRICT,
    cantidad_solicitada NUMERIC(14, 3) NOT NULL CHECK (cantidad_solicitada > 0),
    cantidad_recibida NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
    precio_unitario NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
    subtotal NUMERIC(14, 4) NOT NULL DEFAULT 0,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alm_oc_det_oc ON almacen.orden_compra_detalle(orden_compra_id);
CREATE INDEX IF NOT EXISTS idx_alm_oc_det_prod ON almacen.orden_compra_detalle(producto_id);

-- 3. VINCULACIÓN CON INGRESOS EXISTENTES
ALTER TABLE almacen.ingresos 
ADD COLUMN IF NOT EXISTS orden_compra_id INTEGER REFERENCES almacen.ordenes_compra(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alm_ing_oc ON almacen.ingresos(orden_compra_id);

ALTER TABLE almacen.ingreso_detalle
ADD COLUMN IF NOT EXISTS orden_compra_detalle_id INTEGER REFERENCES almacen.orden_compra_detalle(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alm_ing_det_oc_det ON almacen.ingreso_detalle(orden_compra_detalle_id);

-- 4. PERMISOS DEL SUBMÓDULO ÓRDENES DE COMPRA
INSERT INTO public.permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('almacen', 'ordenes_compra', 'read', 'almacen.ordenes_compra.read', 'Ver órdenes de compra a proveedores'),
('almacen', 'ordenes_compra', 'create', 'almacen.ordenes_compra.create', 'Registrar órdenes de compra a proveedores'),
('almacen', 'ordenes_compra', 'delete', 'almacen.ordenes_compra.delete', 'Anular órdenes de compra')
ON CONFLICT (codigo) DO UPDATE SET
  modulo = EXCLUDED.modulo, submodulo = EXCLUDED.submodulo,
  accion = EXCLUDED.accion, descripcion = EXCLUDED.descripcion;

-- Asignar a roles administrativos y almacenero
INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permisos p ON p.codigo IN ('almacen.ordenes_compra.read', 'almacen.ordenes_compra.create', 'almacen.ordenes_compra.delete')
WHERE r.nombre IN ('SUPER_ADMIN', 'ADMIN', 'ALMACENERO')
ON CONFLICT DO NOTHING;

COMMIT;
