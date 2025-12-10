-- =====================================================
-- TABLA: tarifario_precios
-- Relación entre tarifarios y análisis con su precio
-- =====================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS tarifario_precios (
  id SERIAL PRIMARY KEY,
  tarifario_id INTEGER NOT NULL REFERENCES tarifarios(id) ON DELETE CASCADE,
  analisis_id INTEGER NOT NULL REFERENCES analisis(id) ON DELETE CASCADE,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tarifario_id, analisis_id)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_tarifario_precios_tarifario ON tarifario_precios(tarifario_id);
CREATE INDEX IF NOT EXISTS idx_tarifario_precios_analisis ON tarifario_precios(analisis_id);

-- =====================================================
-- EJEMPLOS DE USO:
-- 
-- Agregar análisis a tarifario:
-- INSERT INTO tarifario_precios (tarifario_id, analisis_id, precio) 
-- VALUES (1, 5, 25.00);
--
-- Actualizar precio:
-- UPDATE tarifario_precios SET precio = 30.00 WHERE tarifario_id = 1 AND analisis_id = 5;
--
-- Obtener precios de un tarifario:
-- SELECT tp.*, a.nombre, a.codigo 
-- FROM tarifario_precios tp 
-- JOIN analisis a ON tp.analisis_id = a.id 
-- WHERE tp.tarifario_id = 1;
-- =====================================================
