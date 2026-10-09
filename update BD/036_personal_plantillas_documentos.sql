-- ============================================================
-- MIGRACIÓN 036: Plantillas Dinámicas de Documentos Laborales
-- Módulo de Personal & Configuración - ViteLab
-- ============================================================

-- 1. TABLA personal_plantillas_documentos
CREATE TABLE IF NOT EXISTS personal_plantillas_documentos (
    id SERIAL PRIMARY KEY,
    tipo_documento VARCHAR(50) NOT NULL UNIQUE, -- 'CONSTANCIA_TRABAJO', 'CERTIFICADO_LABORAL', 'CARTA_PRESENTACION', etc.
    nombre VARCHAR(150) NOT NULL,
    titulo_documento VARCHAR(150) NOT NULL, -- Ej: 'CONSTANCIA DE TRABAJO', 'CERTIFICADO DE TRABAJO'
    cuerpo_template TEXT NOT NULL,
    parrafo_cierre TEXT,
    ciudad_defecto VARCHAR(100) DEFAULT 'LIMA',
    mostrar_logo BOOLEAN DEFAULT TRUE,
    firmante_nombre VARCHAR(150),
    firmante_cargo VARCHAR(150),
    firmante_firma_url TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plantillas_tipo ON personal_plantillas_documentos(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_plantillas_activo ON personal_plantillas_documentos(activo);

COMMENT ON TABLE personal_plantillas_documentos IS 'Configuración de plantillas dinámicas de texto y firmantes para documentos de RRHH';

-- 2. MODIFICAR personal_documentos PARA ALMACENAR EL CONTENIDO CONGELADO Y FIRMANTE
ALTER TABLE personal_documentos
ADD COLUMN IF NOT EXISTS contenido_renderizado TEXT,
ADD COLUMN IF NOT EXISTS plantilla_id INTEGER REFERENCES personal_plantillas_documentos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS firmante_nombre VARCHAR(150),
ADD COLUMN IF NOT EXISTS firmante_cargo VARCHAR(150);

-- 3. PERMISOS PARA GESTIÓN DE PLANTILLAS EN CONFIGURACIÓN
INSERT INTO public.permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('configuracion', 'plantillas_documentos', 'read', 'configuracion.plantillas.read', 'Ver plantillas de documentos de RRHH'),
('configuracion', 'plantillas_documentos', 'manage', 'configuracion.plantillas.manage', 'Crear y editar plantillas de documentos de RRHH')
ON CONFLICT (codigo) DO UPDATE SET
  modulo = EXCLUDED.modulo,
  submodulo = EXCLUDED.submodulo,
  accion = EXCLUDED.accion,
  descripcion = EXCLUDED.descripcion;

-- Asignar permisos a roles administrativos
INSERT INTO public.roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permisos p ON p.codigo IN ('configuracion.plantillas.read', 'configuracion.plantillas.manage')
WHERE r.nombre IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;

-- 4. SEMILLAS INICIALES (BASADAS EN MODELOS REALES DE CONSTANCIA Y CERTIFICADO)
INSERT INTO personal_plantillas_documentos (
    tipo_documento,
    nombre,
    titulo_documento,
    cuerpo_template,
    parrafo_cierre,
    ciudad_defecto,
    mostrar_logo,
    firmante_nombre,
    firmante_cargo,
    activo
) VALUES
(
    'CONSTANCIA_TRABAJO',
    'Constancia de Trabajo (Personal Activo)',
    'CONSTANCIA DE TRABAJO',
    'Por medio del presente **{empresa_nombre}**, con R.U.C. No. **{empresa_ruc}** certifica que el/la Sr(a). **{colaborador_nombre}** identificado/a con {colaborador_documento}, se encuentra trabajando en nuestra empresa desempeñando el cargo de **{cargo}** en el área de **{area}** desde el **{fecha_ingreso}** a la fecha.',
    'Se expide la presente constancia a solicitud del interesado para los fines que estime conveniente.',
    'LIMA',
    TRUE,
    'MONTOYA COTTLE ANAHI',
    'GERENTE DE GESTION DE PERSONAS',
    TRUE
),
(
    'CERTIFICADO_LABORAL',
    'Certificado de Trabajo (Prestación de Servicios / Cese)',
    'CERTIFICADO DE TRABAJO',
    'Por medio del presente, certificamos que el/la Sr(a). **{colaborador_nombre}**, prestó servicios a esta empresa desde el **{fecha_ingreso}** hasta el **{fecha_cese}**, habiéndose desempeñado como **{cargo}**, en el área de **{area}**.',
    'Extendemos el presente certificado a solicitud del interesado para los fines que estime conveniente.',
    'LIMA',
    TRUE,
    'MONTOYA COTTLE ANAHI',
    'GERENTE DE GESTION DE PERSONAS',
    TRUE
),
(
    'CARTA_PRESENTACION',
    'Carta de Presentación Institucional',
    'CARTA DE PRESENTACIÓN',
    'Por medio de la presente, presentamos ante usted al Sr(a). **{colaborador_nombre}**, identificado/a con {colaborador_documento}, quien labora en nuestra institución desempeñando las funciones de **{cargo}** en el área de **{area}**, a fin de solicitarle se le brinden las atenciones y facilidades necesarias correspondientes.',
    'Agradeciendo de antemano la atención brindada a la presente comunicación.',
    'LIMA',
    TRUE,
    'MONTOYA COTTLE ANAHI',
    'GERENTE DE GESTION DE PERSONAS',
    TRUE
)
ON CONFLICT (tipo_documento) DO NOTHING;
