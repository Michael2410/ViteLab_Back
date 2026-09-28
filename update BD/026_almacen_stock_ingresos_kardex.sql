-- ============================================================
-- MIGRACIÓN 026: Lotes, correlativos, ingresos, stock y kardex
-- Depende de: 024_almacen_schema_maestros.sql
-- Idempotente: puede ejecutarse más de una vez sin error
-- ============================================================
BEGIN;

-- 1. LOTES: identidad = producto + número de lote + marca + vencimiento
CREATE TABLE IF NOT EXISTS almacen.lotes (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id) ON DELETE RESTRICT,
    numero_lote VARCHAR(100),          -- NULL para productos sin control de lote ("lote genérico")
    marca VARCHAR(100),
    fecha_vencimiento DATE,
    fecha_fabricacion DATE,
    legacy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Permite FKs compuestas (lote_id, producto_id): un saldo o movimiento no puede mezclar el lote de otro producto
    CONSTRAINT lotes_id_producto_key UNIQUE (id, producto_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alm_lotes_identidad ON almacen.lotes
    (producto_id, COALESCE(numero_lote, ''), COALESCE(marca, ''), COALESCE(fecha_vencimiento, DATE '9999-12-31'));
CREATE INDEX IF NOT EXISTS idx_alm_lotes_vencimiento ON almacen.lotes(fecha_vencimiento);

-- 2. CORRELATIVOS (sin MAX()+1 ni COUNT()+1)
CREATE TABLE IF NOT EXISTS almacen.correlativos (
    tipo VARCHAR(5) NOT NULL,             -- ING, DES, CON, DEV, PED, TRA, AJU
    sede_id INTEGER NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
    anio INTEGER NOT NULL,
    ultimo INTEGER NOT NULL DEFAULT 0 CHECK (ultimo >= 0),
    PRIMARY KEY (tipo, sede_id, anio)
);

-- 3. INGRESOS
CREATE TABLE IF NOT EXISTS almacen.ingresos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    almacen_id INTEGER NOT NULL REFERENCES almacen.almacenes(id) ON DELETE RESTRICT,
    proveedor_id INTEGER REFERENCES almacen.proveedores(id) ON DELETE RESTRICT,
    tipo_documento VARCHAR(20) NOT NULL DEFAULT 'FACTURA',
    serie_documento VARCHAR(20),
    numero_documento VARCHAR(30),
    fecha_documento DATE,
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',
    observaciones TEXT,
    adjunto_url TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO',
    motivo_anulacion TEXT,
    usuario_registro_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    usuario_anulacion_id INTEGER REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    fecha_anulacion TIMESTAMP,
    legacy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- INVENTARIO_INICIAL: carga del saldo de arranque (proveedor NULL), disponible desde la fase 2
    CONSTRAINT ingresos_tipo_documento_check CHECK (tipo_documento IN ('FACTURA','BOLETA','GUIA_REMISION','DONACION','INVENTARIO_INICIAL','OTRO')),
    CONSTRAINT ingresos_estado_check CHECK (estado IN ('REGISTRADO','ANULADO')),
    CONSTRAINT ingresos_anulacion_check CHECK (estado <> 'ANULADO' OR (motivo_anulacion IS NOT NULL AND usuario_anulacion_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_alm_ingresos_almacen_fecha ON almacen.ingresos(almacen_id, fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_alm_ingresos_proveedor_id ON almacen.ingresos(proveedor_id);

CREATE TABLE IF NOT EXISTS almacen.ingreso_detalle (
    id SERIAL PRIMARY KEY,
    ingreso_id INTEGER NOT NULL REFERENCES almacen.ingresos(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id) ON DELETE RESTRICT,
    lote_id INTEGER NOT NULL,
    ubicacion_id INTEGER REFERENCES almacen.ubicaciones(id) ON DELETE RESTRICT,
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),   -- 0 permitido (donaciones)
    legacy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ingreso_detalle_lote_producto_fkey FOREIGN KEY (lote_id, producto_id)
        REFERENCES almacen.lotes (id, producto_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_alm_ingreso_detalle_ingreso ON almacen.ingreso_detalle(ingreso_id);
CREATE INDEX IF NOT EXISTS idx_alm_ingreso_detalle_producto ON almacen.ingreso_detalle(producto_id);

-- 4. STOCK (saldo por almacén y lote)
CREATE TABLE IF NOT EXISTS almacen.stock (
    id SERIAL PRIMARY KEY,
    almacen_id INTEGER NOT NULL REFERENCES almacen.almacenes(id) ON DELETE RESTRICT,
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id) ON DELETE RESTRICT,
    lote_id INTEGER NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT stock_almacen_lote_key UNIQUE (almacen_id, lote_id),
    CONSTRAINT stock_lote_producto_fkey FOREIGN KEY (lote_id, producto_id)
        REFERENCES almacen.lotes (id, producto_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_alm_stock_producto ON almacen.stock(producto_id);

-- 5. MOVIMIENTOS (kardex inmutable)
CREATE TABLE IF NOT EXISTS almacen.movimientos (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(25) NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sede_id INTEGER NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
    almacen_id INTEGER REFERENCES almacen.almacenes(id) ON DELETE RESTRICT,
    personal_id INTEGER REFERENCES public.personal(id) ON DELETE RESTRICT,   -- custodio (DESPACHO/CONSUMO/DEVOLUCION)
    producto_id INTEGER NOT NULL REFERENCES almacen.productos(id) ON DELETE RESTRICT,
    lote_id INTEGER NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(14,4),
    documento_tipo VARCHAR(20) NOT NULL,
    documento_id INTEGER NOT NULL,
    documento_detalle_id INTEGER,
    anula_movimiento_id BIGINT REFERENCES almacen.movimientos(id) ON DELETE RESTRICT,
    observacion TEXT,
    usuario_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,   -- actor (auditoría)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT movimientos_tipo_check CHECK (tipo IN ('INGRESO','DESPACHO','CONSUMO','DEVOLUCION',
        'TRANSFERENCIA_SALIDA','TRANSFERENCIA_ENTRADA','AJUSTE_ENTRADA','AJUSTE_SALIDA','ANULACION')),
    CONSTRAINT movimientos_documento_tipo_check CHECK (documento_tipo IN ('INGRESO','DESPACHO','CONSUMO','DEVOLUCION','TRANSFERENCIA','AJUSTE')),
    CONSTRAINT movimientos_almacen_check CHECK (tipo IN ('CONSUMO','ANULACION') OR almacen_id IS NOT NULL),
    CONSTRAINT movimientos_anulacion_check CHECK ((tipo = 'ANULACION') = (anula_movimiento_id IS NOT NULL)),
    CONSTRAINT movimientos_lote_producto_fkey FOREIGN KEY (lote_id, producto_id)
        REFERENCES almacen.lotes (id, producto_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_alm_mov_producto_fecha ON almacen.movimientos(producto_id, fecha);
CREATE INDEX IF NOT EXISTS idx_alm_mov_almacen_fecha ON almacen.movimientos(almacen_id, fecha);
CREATE INDEX IF NOT EXISTS idx_alm_mov_sede_fecha ON almacen.movimientos(sede_id, fecha);
CREATE INDEX IF NOT EXISTS idx_alm_mov_personal ON almacen.movimientos(personal_id);
CREATE INDEX IF NOT EXISTS idx_alm_mov_lote ON almacen.movimientos(lote_id);
CREATE INDEX IF NOT EXISTS idx_alm_mov_documento ON almacen.movimientos(documento_tipo, documento_id);
-- Un movimiento solo se puede anular una vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_alm_mov_anulacion ON almacen.movimientos(anula_movimiento_id) WHERE anula_movimiento_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_movimientos_inmutable ON almacen.movimientos;
CREATE TRIGGER trg_movimientos_inmutable BEFORE UPDATE OR DELETE ON almacen.movimientos
    FOR EACH ROW EXECUTE FUNCTION almacen.fn_bloquear_modificacion();
COMMENT ON TABLE almacen.movimientos IS 'Kardex inmutable. Correcciones solo mediante movimientos ANULACION o ajustes';

-- Una ANULACION copia almacén, custodio, producto, lote y cantidad del original, y no se anula a sí misma
CREATE OR REPLACE FUNCTION almacen.fn_validar_anulacion()
RETURNS TRIGGER AS $$
DECLARE o almacen.movimientos%ROWTYPE;
BEGIN
    SELECT * INTO o FROM almacen.movimientos WHERE id = NEW.anula_movimiento_id;
    IF o.tipo = 'ANULACION' THEN
        RAISE EXCEPTION 'No se puede anular una anulación (movimiento %)', o.id USING ERRCODE = '23514';
    END IF;
    IF NEW.almacen_id IS DISTINCT FROM o.almacen_id OR NEW.personal_id IS DISTINCT FROM o.personal_id
       OR NEW.producto_id <> o.producto_id OR NEW.lote_id <> o.lote_id OR NEW.cantidad <> o.cantidad THEN
        RAISE EXCEPTION 'La ANULACION debe copiar almacén, custodio, producto, lote y cantidad del movimiento %', o.id USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_movimientos_anulacion ON almacen.movimientos;
CREATE TRIGGER trg_movimientos_anulacion BEFORE INSERT ON almacen.movimientos
    FOR EACH ROW WHEN (NEW.tipo = 'ANULACION') EXECUTE FUNCTION almacen.fn_validar_anulacion();

-- 6. TRIGGERS updated_at
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['lotes','ingresos','stock'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON almacen.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON almacen.%1$I FOR EACH ROW EXECUTE FUNCTION almacen.fn_set_updated_at()', t);
    END LOOP;
END $$;

INSERT INTO almacen.migraciones (version, nombre) VALUES ('026', 'almacen_stock_ingresos_kardex')
ON CONFLICT (version) DO NOTHING;

COMMIT;
