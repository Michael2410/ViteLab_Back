-- ============================================================================
-- Migración 034: Agregar ubicacion_id a almacen.stock y almacen.movimientos
-- Permite visualizar la ubicación física del insumo/lote en Stock & Kardex
-- ============================================================================

-- 1. Agregar columna ubicacion_id a almacen.stock (saldo por lote/almacén)
ALTER TABLE almacen.stock
  ADD COLUMN IF NOT EXISTS ubicacion_id INTEGER REFERENCES almacen.ubicaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alm_stock_ubicacion ON almacen.stock(ubicacion_id);

-- 2. Agregar columna ubicacion_id a almacen.movimientos (kardex)
ALTER TABLE almacen.movimientos
  ADD COLUMN IF NOT EXISTS ubicacion_id INTEGER REFERENCES almacen.ubicaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alm_movimientos_ubicacion ON almacen.movimientos(ubicacion_id);

-- 3. Backfill de ubicaciones existentes en stock a partir de los ingresos registrados
UPDATE almacen.stock s
SET ubicacion_id = sub.ubicacion_id
FROM (
    SELECT DISTINCT ON (i.almacen_id, d.lote_id) i.almacen_id, d.lote_id, d.ubicacion_id
    FROM almacen.ingreso_detalle d
    JOIN almacen.ingresos i ON i.id = d.ingreso_id
    WHERE d.ubicacion_id IS NOT NULL AND i.estado != 'ANULADO'
    ORDER BY i.almacen_id, d.lote_id, i.fecha_ingreso DESC, d.id DESC
) sub
WHERE s.almacen_id = sub.almacen_id
  AND s.lote_id = sub.lote_id
  AND s.ubicacion_id IS NULL;

-- 4. Backfill de ubicaciones en movimientos (kardex) de tipo INGRESO
-- Nota: Se desactiva y reactiva temporalmente el trigger de inmutabilidad para este backfill administrativo
ALTER TABLE almacen.movimientos DISABLE TRIGGER trg_movimientos_inmutable;

UPDATE almacen.movimientos m
SET ubicacion_id = d.ubicacion_id
FROM almacen.ingreso_detalle d
WHERE m.documento_tipo = 'INGRESO'
  AND m.documento_detalle_id = d.id
  AND m.ubicacion_id IS NULL
  AND d.ubicacion_id IS NOT NULL;

ALTER TABLE almacen.movimientos ENABLE TRIGGER trg_movimientos_inmutable;
