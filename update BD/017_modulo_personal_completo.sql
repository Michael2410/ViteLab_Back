-- ============================================
-- SCRIPT 017: MÓDULO PERSONAL (RRHH) COMPLETO
-- Descripción:
--   1. Crear tabla personal (entidad maestra de colaboradores)
--   2. Crear tabla personal_sedes (relación N:N personal - sedes)
--   3. Vincular usuarios con personal (columna personal_id)
--   4. Migrar nombres, apellidos y firmas existentes desde usuarios a personal
--   5. Migrar sedes asignadas de usuarios_sedes a personal_sedes
--   6. Dropear columnas nombres, apellidos, firma_url de usuarios
--   7. Agregar permisos para el módulo personal y asignarlos a SUPER_ADMIN y ADMIN
-- ============================================

-- 1. CREAR TABLA PERSONAL
CREATE TABLE IF NOT EXISTS personal (
    id SERIAL PRIMARY KEY,
    tipo_documento VARCHAR(20) DEFAULT 'DNI',
    numero_documento VARCHAR(30) UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    cargo VARCHAR(100),
    area VARCHAR(100) DEFAULT 'Laboratorio',
    email VARCHAR(100),
    telefono VARCHAR(30),
    direccion TEXT,
    fecha_nacimiento DATE,
    fecha_ingreso DATE,
    tipo_contrato VARCHAR(50),
    sueldo_base NUMERIC(10,2),
    colegiatura VARCHAR(50),
    firma_url TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_personal_numero_documento ON personal(numero_documento);
CREATE INDEX IF NOT EXISTS idx_personal_activo ON personal(activo);
CREATE INDEX IF NOT EXISTS idx_personal_cargo ON personal(cargo);

COMMENT ON TABLE personal IS 'Directorio central de empleados y colaboradores de la empresa';
COMMENT ON COLUMN personal.numero_documento IS 'DNI u otro documento de identidad';
COMMENT ON COLUMN personal.cargo IS 'Cargo o puesto de trabajo (Biólogo, Recepcionista, etc.)';
COMMENT ON COLUMN personal.area IS 'Área funcional (Laboratorio, Almacén, Administración, etc.)';

-- 2. CREAR TABLA PERSONAL_SEDES
CREATE TABLE IF NOT EXISTS personal_sedes (
    id SERIAL PRIMARY KEY,
    personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
    sede_id INTEGER NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(personal_id, sede_id)
);

CREATE INDEX IF NOT EXISTS idx_personal_sedes_personal ON personal_sedes(personal_id);
CREATE INDEX IF NOT EXISTS idx_personal_sedes_sede ON personal_sedes(sede_id);

COMMENT ON TABLE personal_sedes IS 'Relación muchos a muchos entre personal y sedes de trabajo';

-- 3. AGREGAR COLUMNA PERSONAL_ID A USUARIOS
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS personal_id INTEGER REFERENCES personal(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_personal_id ON usuarios(personal_id);

-- 4, 5 y 6. MIGRAR DATOS EXISTENTES Y ELIMINAR COLUMNAS REDUNDANTES
DO $$
DECLARE
    rec RECORD;
    new_pid INTEGER;
    col_exists BOOLEAN;
BEGIN
    -- Verificar si todavía existen las columnas nombres y apellidos en usuarios
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'nombres'
    ) INTO col_exists;

    IF col_exists THEN
        FOR rec IN 
            SELECT usr.id, usr.nombres, usr.apellidos, usr.email, usr.firma_url, usr.activo, usr.rol_id, r.nombre as rol_nombre 
            FROM usuarios usr
            LEFT JOIN roles r ON usr.rol_id = r.id
            WHERE usr.personal_id IS NULL 
        LOOP
            INSERT INTO personal (
                nombres, 
                apellidos, 
                email, 
                firma_url, 
                activo, 
                cargo, 
                area
            )
            VALUES (
                rec.nombres, 
                rec.apellidos, 
                rec.email, 
                rec.firma_url, 
                rec.activo,
                COALESCE(rec.rol_nombre, 'Personal'),
                'Laboratorio'
            )
            RETURNING id INTO new_pid;

            UPDATE usuarios SET personal_id = new_pid WHERE id = rec.id;

            -- Copiar sedes asignadas de usuarios_sedes a personal_sedes si la tabla usuarios_sedes existe
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios_sedes') THEN
                INSERT INTO personal_sedes (personal_id, sede_id)
                SELECT new_pid, us.sede_id
                FROM usuarios_sedes us
                WHERE us.usuario_id = rec.id
                ON CONFLICT (personal_id, sede_id) DO NOTHING;
            END IF;
        END LOOP;
        
        -- Eliminar columnas redundantes de usuarios una vez migrados
        ALTER TABLE usuarios DROP COLUMN IF EXISTS nombres;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS apellidos;
        ALTER TABLE usuarios DROP COLUMN IF EXISTS firma_url;
    END IF;
END $$;

-- 7. INSERTAR PERMISOS DEL MÓDULO PERSONAL
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('personal', NULL, 'read', 'personal.read', 'Acceso general al módulo de Personal'),
('personal', 'directorio', 'create', 'personal.directorio.create', 'Registrar nuevo personal'),
('personal', 'directorio', 'read', 'personal.directorio.read', 'Ver directorio y fichas de personal'),
('personal', 'directorio', 'update', 'personal.directorio.update', 'Editar datos de personal'),
('personal', 'directorio', 'delete', 'personal.directorio.delete', 'Desactivar/eliminar personal'),
('personal', 'cuenta', 'create', 'personal.cuenta.create', 'Crear usuario de sistema para personal'),
('personal', 'cuenta', 'update', 'personal.cuenta.update', 'Editar usuario de sistema de personal'),
('personal', 'cuenta', 'delete', 'personal.cuenta.delete', 'Desvincular o revocar acceso de sistema')
ON CONFLICT (codigo) DO NOTHING;

-- Asignar nuevos permisos al rol SUPER_ADMIN (rol_id = 1)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 1, id FROM permisos 
WHERE modulo = 'personal'
AND id NOT IN (SELECT permiso_id FROM roles_permisos WHERE rol_id = 1)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Asignar nuevos permisos al rol ADMIN (rol_id = 2)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 2, id FROM permisos 
WHERE modulo = 'personal'
AND id NOT IN (SELECT permiso_id FROM roles_permisos WHERE rol_id = 2)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
