-- ============================================================
-- MIGRACIÓN 025: Permisos del módulo Almacén (en public)
-- ============================================================
BEGIN;

INSERT INTO public.permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('almacen','dashboard','read','almacen.dashboard.read','Ver resumen y alertas del almacén'),
('almacen','maestros','read','almacen.maestros.read','Ver unidades, categorías, almacenes y ubicaciones'),
('almacen','maestros','manage','almacen.maestros.manage','Administrar unidades, categorías, almacenes y ubicaciones'),
('almacen','productos','read','almacen.productos.read','Ver catálogo de productos'),
('almacen','productos','create','almacen.productos.create','Registrar productos'),
('almacen','productos','update','almacen.productos.update','Editar productos'),
('almacen','productos','delete','almacen.productos.delete','Desactivar productos'),
('almacen','proveedores','read','almacen.proveedores.read','Ver proveedores'),
('almacen','proveedores','create','almacen.proveedores.create','Registrar proveedores'),
('almacen','proveedores','update','almacen.proveedores.update','Editar proveedores'),
('almacen','proveedores','delete','almacen.proveedores.delete','Desactivar proveedores'),
('almacen','ingresos','read','almacen.ingresos.read','Ver ingresos de almacén'),
('almacen','ingresos','create','almacen.ingresos.create','Registrar ingresos de almacén'),
('almacen','ingresos','delete','almacen.ingresos.delete','Anular ingresos de almacén (contramovimiento)'),
('almacen','stock','read','almacen.stock.read','Ver stock de las sedes asignadas'),
('almacen','stock','read_all','almacen.stock.read_all','Ver y operar el almacén de TODAS las sedes (ignora usuarios_sedes)'),
('almacen','kardex','read','almacen.kardex.read','Ver kardex de movimientos'),
('almacen','despachos','read','almacen.despachos.read','Ver despachos'),
('almacen','despachos','create','almacen.despachos.create','Registrar despachos y atender pedidos'),
('almacen','despachos','delete','almacen.despachos.delete','Anular despachos'),
('almacen','custodia','read','almacen.custodia.read','Ver mi inventario en custodia'),
('almacen','custodia','read_personal','almacen.custodia.read_personal','Ver la custodia y los consumos de todo el personal de sus sedes'),
('almacen','consumos','read','almacen.consumos.read','Ver consumos propios'),
('almacen','consumos','create','almacen.consumos.create','Registrar consumos y devoluciones'),
('almacen','consumos','delete','almacen.consumos.delete','Anular consumos'),
('almacen','pedidos','read','almacen.pedidos.read','Ver pedidos propios'),
('almacen','pedidos','create','almacen.pedidos.create','Solicitar pedidos'),
('almacen','pedidos','approve','almacen.pedidos.approve','Ver, aprobar y rechazar pedidos de sus sedes'),
('almacen','pedidos','delete','almacen.pedidos.delete','Anular pedidos'),
('almacen','transferencias','read','almacen.transferencias.read','Ver transferencias'),
('almacen','transferencias','create','almacen.transferencias.create','Enviar transferencias'),
('almacen','transferencias','approve','almacen.transferencias.approve','Recepcionar transferencias'),
('almacen','transferencias','delete','almacen.transferencias.delete','Anular transferencias en tránsito'),
('almacen','ajustes','read','almacen.ajustes.read','Ver ajustes y bajas'),
('almacen','ajustes','create','almacen.ajustes.create','Registrar ajustes, bajas e inventario inicial'),
('almacen','ajustes','approve','almacen.ajustes.approve','Aprobar ajustes y bajas'),
('almacen','reportes','read','almacen.reportes.read','Ver reportes de almacén'),
('almacen','reportes','export','almacen.reportes.export','Exportar reportes de almacén')
ON CONFLICT (codigo) DO UPDATE SET
  modulo = EXCLUDED.modulo, submodulo = EXCLUDED.submodulo,
  accion = EXCLUDED.accion, descripcion = EXCLUDED.descripcion;

-- Rol encargado de almacén (equivale a role-encargado del legacy).
INSERT INTO public.roles (nombre, descripcion)
VALUES ('ALMACENERO', 'Encargado de almacén: catálogo, ingresos, despachos, pedidos, transferencias y ajustes')
ON CONFLICT (nombre) DO NOTHING;

-- SUPER_ADMIN y ADMIN: todo almacén. ALMACENERO: todo SALVO stock.read_all (queda limitado a sus sedes)
INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permisos p ON p.modulo = 'almacen'
WHERE r.nombre IN ('SUPER_ADMIN', 'ADMIN')
   OR (r.nombre = 'ALMACENERO' AND p.codigo <> 'almacen.stock.read_all')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Perfil "trabajador" del legacy para LABORATORISTA
INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permisos p ON p.codigo IN (
  'almacen.maestros.read','almacen.productos.read','almacen.custodia.read',
  'almacen.consumos.read','almacen.consumos.create',
  'almacen.pedidos.read','almacen.pedidos.create','almacen.pedidos.delete')
WHERE r.nombre IN ('LABORATORISTA')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

INSERT INTO almacen.migraciones (version, nombre) VALUES ('025', 'almacen_permisos')
ON CONFLICT (version) DO NOTHING;

COMMIT;
