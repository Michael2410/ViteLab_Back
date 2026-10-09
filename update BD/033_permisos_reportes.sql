-- ============================================================================
-- Migración 033: Permisos del Módulo de Reportes (incluye Cuadre de Caja y General)
-- Módulo: reports
-- Submódulos: general, ordenes, ingresos, analisis, productividad, cuadre_caja
-- ============================================================================

-- 1. Insertar o actualizar la matriz completa de permisos del módulo de reportes
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('reports', 'general', 'read', 'reports.read', 'Acceso general al módulo de reportes'),
('reports', 'ordenes', 'read', 'reports.ordenes.read', 'Ver reporte de órdenes por período'),
('reports', 'ingresos', 'read', 'reports.ingresos.read', 'Ver reporte de ingresos por sede'),
('reports', 'analisis', 'read', 'reports.analisis.read', 'Ver reporte de ranking de análisis más solicitados'),
('reports', 'productividad', 'read', 'reports.productividad.read', 'Ver reporte de productividad del personal'),
('reports', 'cuadre_caja', 'read', 'reports.cuadre_caja.read', 'Ver reporte de cuadre de caja diaria')
ON CONFLICT (codigo) DO UPDATE SET
  modulo = EXCLUDED.modulo,
  submodulo = EXCLUDED.submodulo,
  accion = EXCLUDED.accion,
  descripcion = EXCLUDED.descripcion;

-- 2. Asignar los permisos de reportes a SUPER_ADMIN (rol_id = 1) y ADMIN (rol_id = 2)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 1, id FROM permisos
WHERE modulo = 'reports'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 2, id FROM permisos
WHERE modulo = 'reports'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
