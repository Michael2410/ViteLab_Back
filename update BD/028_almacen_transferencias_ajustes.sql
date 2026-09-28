-- ============================================================
-- MIGRACIÓN 028: Transferencias entre Almacenes y Ajustes/Bajas
-- ============================================================
BEGIN;

-- 1. TRANSFERENCIAS ENTRE ALMACENES
CREATE TABLE IF NOT EXISTS almacen.transferencias (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    almacen_origen_id INTEGER NOT NULL REFERENCES almacen.almacenes(id),
    almacen_destino_id INTEGER NOT NULL REFERENCES almacen.almacenes(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'EN_TRANSITO',
    usuario_envio_id INTEGER NOT NULL REFERENCES public.usuarios(id),
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usuario_recepcion_id INTEGER REFERENCES public.usuarios(id),
    fecha_recepcion TIMESTAMP,
    motivo_anulacion TEXT,
    usuario_anulacion_id INTEGER REFERENCES public.usuarios(id),
    fecha_anulacion TIMESTAMP,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_transf_almacenes_distintos CHECK (almacen_origen_id <> almacen_destino_id),
    CONSTRAINT chk_transf_estado CHECK (estado IN ('EN_TRANSITO', 'RECIBIDA', 'ANULADA'))
);

CREATE INDEX IF NOT EXISTS idx_alm_transf_origen ON almacen.transferencias(almacen_origen_id);
CREATE INDEX IF NOT EXISTS idx_alm_transf_destino ON almacen.transferencias(almacen_destino_id);
CREATE INDEX IF NOT EXISTS idx_alm_transf_estado ON almacen.transferencias(estado);
CREATE INDEX IF NOT EXISTS idx_alm_transf_fecha ON almacen.transferencias(fecha_envio);

-- 2. DETALLE DE TRANSFERENCIAS
CREATE TABLE IF NOT EXISTS almacen.transferencia_detalle (
    id SERIAL PRIMARY KEY,
    transferencia_id INTEGER NOT NULL REFERENCES almacen.transferencias(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id),
    lote_id INTEGER NOT NULL REFERENCES almacen.lotes(id),
    cantidad_enviada NUMERIC(14,3) NOT NULL,
    cantidad_recibida NUMERIC(14,3),
    motivo_diferencia TEXT,
    CONSTRAINT chk_transf_det_cant_enviada CHECK (cantidad_enviada > 0),
    CONSTRAINT chk_transf_det_cant_recibida CHECK (cantidad_recibida IS NULL OR (cantidad_recibida >= 0 AND cantidad_recibida <= cantidad_enviada))
);

CREATE INDEX IF NOT EXISTS idx_alm_transf_det_transf ON almacen.transferencia_detalle(transferencia_id);
CREATE INDEX IF NOT EXISTS idx_alm_transf_det_prod_lote ON almacen.transferencia_detalle(producto_id, lote_id);

-- 3. AJUSTES Y BAJAS DE INVENTARIO
CREATE TABLE IF NOT EXISTS almacen.ajustes (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    almacen_id INTEGER NOT NULL REFERENCES almacen.almacenes(id),
    tipo VARCHAR(30) NOT NULL,
    motivo VARCHAR(50),
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    usuario_registro_id INTEGER NOT NULL REFERENCES public.usuarios(id),
    usuario_aprobacion_id INTEGER REFERENCES public.usuarios(id),
    fecha_aprobacion TIMESTAMP,
    motivo_rechazo TEXT,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ajuste_tipo CHECK (tipo IN ('CONTEO_FISICO', 'MERMA', 'BAJA', 'REGULARIZACION')),
    CONSTRAINT chk_ajuste_estado CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
    CONSTRAINT chk_ajuste_cuatro_ojos CHECK (usuario_aprobacion_id IS NULL OR usuario_aprobacion_id <> usuario_registro_id)
);

CREATE INDEX IF NOT EXISTS idx_alm_ajustes_almacen ON almacen.ajustes(almacen_id);
CREATE INDEX IF NOT EXISTS idx_alm_ajustes_estado ON almacen.ajustes(estado);
CREATE INDEX IF NOT EXISTS idx_alm_ajustes_tipo ON almacen.ajustes(tipo);

-- 4. DETALLE DE AJUSTES
CREATE TABLE IF NOT EXISTS almacen.ajuste_detalle (
    id SERIAL PRIMARY KEY,
    ajuste_id INTEGER NOT NULL REFERENCES almacen.ajustes(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id),
    lote_id INTEGER NOT NULL REFERENCES almacen.lotes(id),
    cantidad NUMERIC(14,3) NOT NULL,
    sentido VARCHAR(10) NOT NULL,
    costo_unitario NUMERIC(14,4) DEFAULT 0,
    observacion TEXT,
    CONSTRAINT chk_ajuste_det_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_ajuste_det_sentido CHECK (sentido IN ('ENTRADA', 'SALIDA'))
);

CREATE INDEX IF NOT EXISTS idx_alm_ajuste_det_ajuste ON almacen.ajuste_detalle(ajuste_id);
CREATE INDEX IF NOT EXISTS idx_alm_ajuste_det_prod_lote ON almacen.ajuste_detalle(producto_id, lote_id);

COMMIT;
