-- ============================================================
-- MIGRACIÓN 027: Pedidos, Despachos, Custodia, Consumos y Devoluciones
-- Módulo de Almacén & Logística - ViteLab (Fase 3)
-- Depende de: 024, 025 y 026
-- ============================================================
BEGIN;

-- 1. CHECK de custodia del kardex
ALTER TABLE almacen.movimientos DROP CONSTRAINT IF EXISTS movimientos_custodia_check;
ALTER TABLE almacen.movimientos ADD CONSTRAINT movimientos_custodia_check
    CHECK (tipo NOT IN ('DESPACHO','CONSUMO','DEVOLUCION') OR personal_id IS NOT NULL);

-- 2. STOCK EN CUSTODIA (inventario asignado a cada persona por almacén de origen y lote)
CREATE TABLE IF NOT EXISTS almacen.stock_custodia (
    id SERIAL PRIMARY KEY,
    personal_id INTEGER NOT NULL REFERENCES public.personal(id) ON DELETE RESTRICT,
    almacen_origen_id INTEGER NOT NULL REFERENCES almacen.almacenes(id) ON DELETE RESTRICT,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id) ON DELETE RESTRICT,
    lote_id INTEGER NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT stock_custodia_personal_almacen_lote_key UNIQUE (personal_id, almacen_origen_id, lote_id),
    CONSTRAINT stock_custodia_lote_producto_fkey FOREIGN KEY (lote_id, producto_id)
        REFERENCES almacen.lotes (id, producto_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_alm_stock_custodia_personal ON almacen.stock_custodia(personal_id);
CREATE INDEX IF NOT EXISTS idx_alm_stock_custodia_producto ON almacen.stock_custodia(producto_id);

-- 3. PEDIDOS INTERNOS
CREATE TABLE IF NOT EXISTS almacen.pedidos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    almacen_id INTEGER NOT NULL REFERENCES almacen.almacenes(id) ON DELETE RESTRICT,
    solicitante_personal_id INTEGER NOT NULL REFERENCES public.personal(id) ON DELETE RESTRICT,
    area_id INTEGER REFERENCES public.areas(id) ON DELETE SET NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    observaciones TEXT,
    motivo_rechazo TEXT,
    motivo_anulacion TEXT,
    motivo_cierre TEXT,
    usuario_registro_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    usuario_aprobacion_id INTEGER REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    fecha_aprobacion TIMESTAMP,
    fecha_atencion TIMESTAMP,
    usuario_anulacion_id INTEGER REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    fecha_anulacion TIMESTAMP,
    legacy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pedidos_estado_check CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO','ATENDIDO_PARCIAL','ATENDIDO','CERRADO','ANULADO')),
    CONSTRAINT pedidos_rechazo_check CHECK (estado <> 'RECHAZADO' OR motivo_rechazo IS NOT NULL),
    CONSTRAINT pedidos_cierre_check CHECK (estado <> 'CERRADO' OR motivo_cierre IS NOT NULL),
    CONSTRAINT pedidos_anulacion_check CHECK (estado <> 'ANULADO' OR (motivo_anulacion IS NOT NULL AND usuario_anulacion_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_alm_pedidos_almacen_estado ON almacen.pedidos(almacen_id, estado);
CREATE INDEX IF NOT EXISTS idx_alm_pedidos_solicitante ON almacen.pedidos(solicitante_personal_id);

CREATE TABLE IF NOT EXISTS almacen.pedido_detalle (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES almacen.pedidos(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id) ON DELETE RESTRICT,
    cantidad_solicitada NUMERIC(14,3) NOT NULL CHECK (cantidad_solicitada > 0),
    cantidad_aprobada NUMERIC(14,3) CHECK (cantidad_aprobada >= 0 AND cantidad_aprobada <= cantidad_solicitada),
    cantidad_atendida NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (cantidad_atendida >= 0),
    observacion TEXT,
    CONSTRAINT pedido_detalle_atendida_check CHECK (cantidad_atendida <= COALESCE(cantidad_aprobada, cantidad_solicitada)),
    CONSTRAINT pedido_detalle_producto_key UNIQUE (pedido_id, producto_id)
);
CREATE INDEX IF NOT EXISTS idx_alm_pedido_detalle_pedido ON almacen.pedido_detalle(pedido_id);

-- 4. DESPACHOS (Almacén → Custodia del trabajador)
CREATE TABLE IF NOT EXISTS almacen.despachos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    almacen_id INTEGER NOT NULL REFERENCES almacen.almacenes(id) ON DELETE RESTRICT,
    receptor_personal_id INTEGER NOT NULL REFERENCES public.personal(id) ON DELETE RESTRICT,
    area_id INTEGER REFERENCES public.areas(id) ON DELETE SET NULL,
    pedido_id INTEGER REFERENCES almacen.pedidos(id) ON DELETE RESTRICT,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO' CHECK (estado IN ('REGISTRADO','ANULADO')),
    motivo_anulacion TEXT,
    usuario_registro_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    usuario_anulacion_id INTEGER REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    fecha_anulacion TIMESTAMP,
    legacy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT despachos_anulacion_check CHECK (estado <> 'ANULADO' OR (motivo_anulacion IS NOT NULL AND usuario_anulacion_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_alm_despachos_almacen ON almacen.despachos(almacen_id);
CREATE INDEX IF NOT EXISTS idx_alm_despachos_receptor ON almacen.despachos(receptor_personal_id);

CREATE TABLE IF NOT EXISTS almacen.despacho_detalle (
    id SERIAL PRIMARY KEY,
    despacho_id INTEGER NOT NULL REFERENCES almacen.despachos(id) ON DELETE CASCADE,
    pedido_detalle_id INTEGER REFERENCES almacen.pedido_detalle(id) ON DELETE RESTRICT,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id) ON DELETE RESTRICT,
    lote_id INTEGER NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    CONSTRAINT despacho_detalle_lote_producto_fkey FOREIGN KEY (lote_id, producto_id)
        REFERENCES almacen.lotes (id, producto_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_alm_despacho_detalle_despacho ON almacen.despacho_detalle(despacho_id);

-- 5. CONSUMOS (Custodia del trabajador → Consumido/Gastado)
CREATE TABLE IF NOT EXISTS almacen.consumos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    sede_id INTEGER NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
    personal_id INTEGER NOT NULL REFERENCES public.personal(id) ON DELETE RESTRICT,
    area_id INTEGER REFERENCES public.areas(id) ON DELETE SET NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO' CHECK (estado IN ('REGISTRADO','ANULADO')),
    motivo_anulacion TEXT,
    usuario_registro_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    usuario_anulacion_id INTEGER REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    fecha_anulacion TIMESTAMP,
    legacy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT consumos_anulacion_check CHECK (estado <> 'ANULADO' OR (motivo_anulacion IS NOT NULL AND usuario_anulacion_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_alm_consumos_personal ON almacen.consumos(personal_id);
CREATE INDEX IF NOT EXISTS idx_alm_consumos_sede ON almacen.consumos(sede_id);

CREATE TABLE IF NOT EXISTS almacen.consumo_detalle (
    id SERIAL PRIMARY KEY,
    consumo_id INTEGER NOT NULL REFERENCES almacen.consumos(id) ON DELETE CASCADE,
    almacen_origen_id INTEGER NOT NULL REFERENCES almacen.almacenes(id) ON DELETE RESTRICT,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id) ON DELETE RESTRICT,
    lote_id INTEGER NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    observacion TEXT,
    CONSTRAINT consumo_detalle_lote_producto_fkey FOREIGN KEY (lote_id, producto_id)
        REFERENCES almacen.lotes (id, producto_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_alm_consumo_detalle_consumo ON almacen.consumo_detalle(consumo_id);

-- 6. DEVOLUCIONES (Custodia del trabajador → Retorno al almacén de origen)
CREATE TABLE IF NOT EXISTS almacen.devoluciones (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    almacen_id INTEGER NOT NULL REFERENCES almacen.almacenes(id) ON DELETE RESTRICT,
    personal_id INTEGER NOT NULL REFERENCES public.personal(id) ON DELETE RESTRICT,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO' CHECK (estado IN ('REGISTRADO','ANULADO')),
    motivo_anulacion TEXT,
    usuario_registro_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    usuario_anulacion_id INTEGER REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    fecha_anulacion TIMESTAMP,
    legacy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT devoluciones_anulacion_check CHECK (estado <> 'ANULADO' OR (motivo_anulacion IS NOT NULL AND usuario_anulacion_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_alm_devoluciones_almacen ON almacen.devoluciones(almacen_id);
CREATE INDEX IF NOT EXISTS idx_alm_devoluciones_personal ON almacen.devoluciones(personal_id);

CREATE TABLE IF NOT EXISTS almacen.devolucion_detalle (
    id SERIAL PRIMARY KEY,
    devolucion_id INTEGER NOT NULL REFERENCES almacen.devoluciones(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id) ON DELETE RESTRICT,
    lote_id INTEGER NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    observacion TEXT,
    CONSTRAINT devolucion_detalle_lote_producto_fkey FOREIGN KEY (lote_id, producto_id)
        REFERENCES almacen.lotes (id, producto_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_alm_devolucion_detalle_devolucion ON almacen.devolucion_detalle(devolucion_id);

-- 7. TRIGGERS updated_at
DROP TRIGGER IF EXISTS trg_stock_custodia_updated_at ON almacen.stock_custodia;
CREATE TRIGGER trg_stock_custodia_updated_at BEFORE UPDATE ON almacen.stock_custodia
    FOR EACH ROW EXECUTE FUNCTION almacen.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_pedidos_updated_at ON almacen.pedidos;
CREATE TRIGGER trg_pedidos_updated_at BEFORE UPDATE ON almacen.pedidos
    FOR EACH ROW EXECUTE FUNCTION almacen.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_despachos_updated_at ON almacen.despachos;
CREATE TRIGGER trg_despachos_updated_at BEFORE UPDATE ON almacen.despachos
    FOR EACH ROW EXECUTE FUNCTION almacen.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_consumos_updated_at ON almacen.consumos;
CREATE TRIGGER trg_consumos_updated_at BEFORE UPDATE ON almacen.consumos
    FOR EACH ROW EXECUTE FUNCTION almacen.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_devoluciones_updated_at ON almacen.devoluciones;
CREATE TRIGGER trg_devoluciones_updated_at BEFORE UPDATE ON almacen.devoluciones
    FOR EACH ROW EXECUTE FUNCTION almacen.fn_set_updated_at();

-- 8. REGISTRO DE MIGRACIÓN
INSERT INTO almacen.migraciones (version, nombre) VALUES ('027', 'almacen_pedidos_despachos_consumos')
ON CONFLICT (version) DO NOTHING;

COMMIT;
