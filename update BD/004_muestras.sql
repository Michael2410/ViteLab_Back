-- =====================================================
-- MÓDULO: Muestras
-- Fecha: 2025-12-02
-- =====================================================

-- 1. Crear tabla de muestras
CREATE TABLE IF NOT EXISTS muestras (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear tabla de relación componente-muestras (muchos a muchos)
CREATE TABLE IF NOT EXISTS componente_muestras (
  id SERIAL PRIMARY KEY,
  componente_id INTEGER NOT NULL REFERENCES componentes(id) ON DELETE CASCADE,
  muestra_id INTEGER NOT NULL REFERENCES muestras(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(componente_id, muestra_id)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_componente_muestras_componente ON componente_muestras(componente_id);
CREATE INDEX IF NOT EXISTS idx_componente_muestras_muestra ON componente_muestras(muestra_id);

-- 4. Insertar muestras comunes de laboratorio
INSERT INTO muestras (nombre, descripcion) VALUES 
  ('Sangre Total', 'Muestra de sangre completa con anticoagulante'),
  ('Suero', 'Fracción líquida de la sangre sin factores de coagulación'),
  ('Plasma', 'Fracción líquida de la sangre con anticoagulante'),
  ('Orina', 'Muestra de orina'),
  ('Heces', 'Muestra de materia fecal'),
  ('Esputo', 'Muestra de secreción respiratoria'),
  ('LCR', 'Líquido cefalorraquídeo'),
  ('Líquido Sinovial', 'Líquido articular'),
  ('Líquido Pleural', 'Líquido de la cavidad pleural'),
  ('Líquido Ascítico', 'Líquido de la cavidad abdominal'),
  ('Secreción', 'Secreción de herida o lesión'),
  ('Hisopado Nasal', 'Muestra nasofaríngea'),
  ('Hisopado Faríngeo', 'Muestra de garganta'),
  ('Biopsia', 'Muestra de tejido')
ON CONFLICT (nombre) DO NOTHING;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT * FROM muestras;
-- SELECT cm.*, c.nombre as componente, m.nombre as muestra 
-- FROM componente_muestras cm 
-- JOIN componentes c ON cm.componente_id = c.id 
-- JOIN muestras m ON cm.muestra_id = m.id;
