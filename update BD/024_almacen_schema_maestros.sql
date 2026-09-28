-- ============================================================
-- MIGRACIÓN 024: Schema "almacen" y maestros
-- Módulo de Almacén & Logística - ViteLab
-- Descripción:
--   1. Schema almacen + tabla de control de migraciones
--   2. Funciones: updated_at y bloqueo de modificaciones (kardex)
--   3. Maestros: unidades_medida, categorias, proveedores, almacenes, ubicaciones
--   4. Maestro de productos
-- Dependencias: public.sedes, public.usuarios, public.areas
-- Rollback: ROLLBACK_024_028_almacen.sql
-- ============================================================
BEGIN;

-- 1. SCHEMA Y CONTROL
CREATE SCHEMA IF NOT EXISTS almacen;
COMMENT ON SCHEMA almacen IS 'Módulo Almacén & Logística: productos, lotes, stock, kardex, pedidos y despachos';

CREATE TABLE IF NOT EXISTS almacen.migraciones (
    version VARCHAR(10) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    aplicado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. FUNCIONES
CREATE OR REPLACE FUNCTION almacen.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION almacen.fn_bloquear_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'La tabla %.% es inmutable: registre un contramovimiento', TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- 3.1 UNIDADES DE MEDIDA
CREATE TABLE IF NOT EXISTS almacen.unidades_medida (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(50) NOT NULL,
    permite_decimales BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO almacen.unidades_medida (codigo, nombre, permite_decimales) VALUES
('UNIDAD','Unidad',false), ('CAJA','Caja',false), ('PAQUETE','Paquete',false),
('KG','Kilogramo',true), ('G','Gramo',true), ('L','Litro',true),
('ML','Mililitro',true), ('M','Metro',true), ('CM','Centímetro',true)
ON CONFLICT (codigo) DO NOTHING;

-- 3.2 CATEGORÍAS
CREATE TABLE IF NOT EXISTS almacen.categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO almacen.categorias (nombre) VALUES
('Reactivos'), ('Controles y calibradores'), ('Consumibles de laboratorio'),
('Material de vidrio'), ('EPP'), ('Limpieza'), ('Oficina')
ON CONFLICT (nombre) DO NOTHING;

-- 3.3 PROVEEDORES
CREATE TABLE IF NOT EXISTS almacen.proveedores (
    id SERIAL PRIMARY KEY,
    ruc VARCHAR(11) UNIQUE,
    razon_social VARCHAR(200) NOT NULL,
    nombre_comercial VARCHAR(200),
    direccion TEXT,
    contacto VARCHAR(150),
    telefono VARCHAR(30),
    email VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT true,
    legacy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT proveedores_ruc_check CHECK (ruc IS NULL OR ruc ~ '^[0-9]{11}$')
);

-- 3.4 ALMACENES (por sede)
CREATE TABLE IF NOT EXISTS almacen.almacenes (
    id SERIAL PRIMARY KEY,
    sede_id INTEGER NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    es_principal BOOLEAN NOT NULL DEFAULT false,
    responsable_usuario_id INTEGER REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    activo BOOLEAN NOT NULL DEFAULT true,
    legacy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT almacenes_sede_nombre_key UNIQUE (sede_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_alm_almacenes_sede_id ON almacen.almacenes(sede_id);
-- Un solo almacén principal por sede
CREATE UNIQUE INDEX IF NOT EXISTS uq_alm_almacenes_principal ON almacen.almacenes(sede_id) WHERE es_principal;

-- 3.5 UBICACIONES
CREATE TABLE IF NOT EXISTS almacen.ubicaciones (
    id SERIAL PRIMARY KEY,
    almacen_id INTEGER NOT NULL REFERENCES almacen.almacenes(id) ON DELETE RESTRICT,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'ESTANTE',
    temp_min NUMERIC(5,2),
    temp_max NUMERIC(5,2),
    activo BOOLEAN NOT NULL DEFAULT true,
    legacy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ubicaciones_almacen_codigo_key UNIQUE (almacen_id, codigo),
    CONSTRAINT ubicaciones_tipo_check CHECK (tipo IN ('ESTANTE','REFRIGERADOR','CONGELADOR','AMBIENTE','OTRO')),
    CONSTRAINT ubicaciones_temp_check CHECK (temp_min IS NULL OR temp_max IS NULL OR temp_min <= temp_max)
);
CREATE INDEX IF NOT EXISTS idx_alm_ubicaciones_almacen_id ON almacen.ubicaciones(almacen_id);

-- 4. PRODUCTOS
CREATE TABLE IF NOT EXISTS almacen.productos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria_id INTEGER REFERENCES almacen.categorias(id) ON DELETE RESTRICT,
    unidad_medida_id INTEGER NOT NULL REFERENCES almacen.unidades_medida(id) ON DELETE RESTRICT,
    area_id INTEGER REFERENCES public.areas(id) ON DELETE SET NULL,   -- sección del laboratorio usuaria (opcional)
    stock_minimo NUMERIC(14,3) NOT NULL DEFAULT 0,
    controla_lote BOOLEAN NOT NULL DEFAULT false,
    controla_vencimiento BOOLEAN NOT NULL DEFAULT false,
    requiere_cadena_frio BOOLEAN NOT NULL DEFAULT false,
    temp_min NUMERIC(5,2),
    temp_max NUMERIC(5,2),
    dias_alerta_vencimiento INTEGER NOT NULL DEFAULT 30,
    activo BOOLEAN NOT NULL DEFAULT true,
    legacy_id VARCHAR(50) UNIQUE,
    usuario_registro_id INTEGER REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT productos_stock_minimo_check CHECK (stock_minimo >= 0),
    CONSTRAINT productos_dias_alerta_check CHECK (dias_alerta_vencimiento BETWEEN 0 AND 365),
    CONSTRAINT productos_frio_check CHECK (NOT requiere_cadena_frio OR (temp_min IS NOT NULL AND temp_max IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_alm_productos_nombre ON almacen.productos(nombre);
CREATE INDEX IF NOT EXISTS idx_alm_productos_categoria_id ON almacen.productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_alm_productos_activo ON almacen.productos(activo);
COMMENT ON TABLE almacen.productos IS 'Maestro de productos, insumos y reactivos. Toda cantidad se expresa en la unidad base (unidad_medida_id)';
COMMENT ON COLUMN almacen.productos.legacy_id IS 'ID original en AlmacenApp (SQLite) para trazabilidad del ETL';

-- 5. TRIGGERS updated_at
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['unidades_medida','categorias','proveedores','almacenes','ubicaciones','productos'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON almacen.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON almacen.%1$I FOR EACH ROW EXECUTE FUNCTION almacen.fn_set_updated_at()', t);
    END LOOP;
END $$;

INSERT INTO almacen.migraciones (version, nombre) VALUES ('024', 'almacen_schema_maestros')
ON CONFLICT (version) DO NOTHING;

COMMIT;
