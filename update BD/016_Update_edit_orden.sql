-- ============================================
-- SCRIPT 016: ACTUALIZACIÓN EDICIÓN DE ÓRDENES Y PRECIOS
-- Descripción: Permisos para edición de precios y edición integral de órdenes
-- ============================================

-- 1. Permiso para edición de precios en órdenes (aislado de los demás)
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('orders', NULL, 'editar precio', 'orders.edit_price', 'Editar precios de análisis en órdenes')
ON CONFLICT (codigo) DO NOTHING;

-- 2. Asegurar existencia de permiso para edición de órdenes
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('orders', NULL, 'update', 'orders.update', 'Editar órdenes de atención')
ON CONFLICT (codigo) DO NOTHING;

-- 3. Asignar permisos al rol SUPER_ADMIN (rol_id = 1)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 1, id FROM permisos 
WHERE codigo IN ('orders.edit_price', 'orders.update')
AND id NOT IN (SELECT permiso_id FROM roles_permisos WHERE rol_id = 1)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- 4. Asignar permisos al rol ADMIN (rol_id = 2)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 2, id FROM permisos 
WHERE codigo IN ('orders.edit_price', 'orders.update')
AND id NOT IN (SELECT permiso_id FROM roles_permisos WHERE rol_id = 2)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT r.nombre as rol, p.codigo as permiso, p.descripcion 
FROM roles_permisos rp
JOIN roles r ON rp.rol_id = r.id
JOIN permisos p ON rp.permiso_id = p.id
WHERE p.codigo IN ('orders.edit_price', 'orders.update');
