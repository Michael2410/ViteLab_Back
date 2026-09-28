-- ============================================================
-- ROLLBACK 024-028: Reversión completa del módulo Almacén
-- ⚠ DESTRUCTIVO: elimina TODO el módulo (datos incluidos). Solo en desarrollo o con backup y autorización explícita.
-- ============================================================
BEGIN;
DELETE FROM public.roles_permisos WHERE permiso_id IN (SELECT id FROM public.permisos WHERE modulo = 'almacen');
DELETE FROM public.permisos WHERE modulo = 'almacen';
-- Quitar el rol solo si nadie lo usa y no conserva permisos de otros módulos
DELETE FROM public.roles r WHERE r.nombre = 'ALMACENERO'
  AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.rol_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM public.roles_permisos rp WHERE rp.rol_id = r.id);
DROP SCHEMA IF EXISTS almacen CASCADE;
COMMIT;
