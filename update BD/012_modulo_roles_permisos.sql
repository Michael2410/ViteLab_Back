-- ============================================
-- SCRIPT 012: MÓDULO ROLES Y PERMISOS
-- Descripción: Agregar permisos faltantes y actualizar estructura
-- ============================================

-- ============================================
-- AGREGAR PERMISOS FALTANTES
-- ============================================

-- CATALOGS - TIPOS CLIENTE
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('catalogs', 'tipos-cliente', 'create', 'catalogs.tipos-cliente.create', 'Crear tipos de cliente'),
('catalogs', 'tipos-cliente', 'read', 'catalogs.tipos-cliente.read', 'Ver tipos de cliente'),
('catalogs', 'tipos-cliente', 'update', 'catalogs.tipos-cliente.update', 'Editar tipos de cliente'),
('catalogs', 'tipos-cliente', 'delete', 'catalogs.tipos-cliente.delete', 'Eliminar tipos de cliente')
ON CONFLICT (codigo) DO NOTHING;

-- CATALOGS - MUESTRAS
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('catalogs', 'muestras', 'create', 'catalogs.muestras.create', 'Crear tipos de muestra'),
('catalogs', 'muestras', 'read', 'catalogs.muestras.read', 'Ver tipos de muestra'),
('catalogs', 'muestras', 'update', 'catalogs.muestras.update', 'Editar tipos de muestra'),
('catalogs', 'muestras', 'delete', 'catalogs.muestras.delete', 'Eliminar tipos de muestra')
ON CONFLICT (codigo) DO NOTHING;

-- REPORTS
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('reports', NULL, 'read', 'reports.read', 'Ver reportes'),
('reports', 'ordenes', 'read', 'reports.ordenes.read', 'Ver reporte de órdenes por período'),
('reports', 'ingresos', 'read', 'reports.ingresos.read', 'Ver reporte de ingresos por sede'),
('reports', 'analisis', 'read', 'reports.analisis.read', 'Ver reporte de ranking de análisis'),
('reports', 'productividad', 'read', 'reports.productividad.read', 'Ver reporte de productividad')
ON CONFLICT (codigo) DO NOTHING;

-- DASHBOARD
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('dashboard', NULL, 'read', 'dashboard.read', 'Ver dashboard')
ON CONFLICT (codigo) DO NOTHING;

-- Asignar nuevos permisos al rol SUPER_ADMIN
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 1, id FROM permisos 
WHERE id NOT IN (SELECT permiso_id FROM roles_permisos WHERE rol_id = 1)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Asignar nuevos permisos al rol ADMIN (excepto gestión de roles)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 2, id FROM permisos 
WHERE codigo NOT LIKE 'auth.roles%'
AND id NOT IN (SELECT permiso_id FROM roles_permisos WHERE rol_id = 2)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- ============================================
-- VERIFICAR PERMISOS
-- ============================================

-- Listar todos los permisos agrupados por módulo
SELECT 
  modulo,
  submodulo,
  COUNT(*) as total_permisos,
  string_agg(codigo, ', ' ORDER BY codigo) as permisos
FROM permisos
GROUP BY modulo, submodulo
ORDER BY modulo, submodulo;
