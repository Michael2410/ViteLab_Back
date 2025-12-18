-- =====================================================
-- 013: MÓDULO WHATSAPP - TABLA DE SESIONES
-- =====================================================
-- Fecha: 2024-12-13
-- Descripción: Crea la tabla para almacenar las credenciales 
--              de WhatsApp (Baileys) en PostgreSQL.
--              Esto permite que las sesiones persistan en Docker.
-- =====================================================

-- Crear tabla para almacenar sesiones de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL DEFAULT 'default',
    data_key VARCHAR(255) NOT NULL,
    data_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, data_key)
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_session_id ON whatsapp_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_key ON whatsapp_sessions(data_key);

-- Tabla para estado de conexión (opcional pero útil para UI)
CREATE TABLE IF NOT EXISTS whatsapp_connection_status (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL DEFAULT 'default' UNIQUE,
    is_connected BOOLEAN DEFAULT FALSE,
    phone_number VARCHAR(20),
    last_connected_at TIMESTAMP,
    last_disconnected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para log de mensajes enviados (auditoría)
CREATE TABLE IF NOT EXISTS whatsapp_messages_log (
    id SERIAL PRIMARY KEY,
    orden_id INTEGER REFERENCES ordenes(id) ON DELETE SET NULL,
    phone_number VARCHAR(20) NOT NULL,
    message_type VARCHAR(50) DEFAULT 'document', -- 'text', 'document', 'image'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    error_message TEXT,
    sent_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para log de mensajes
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_orden ON whatsapp_messages_log(orden_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages_log(status);

-- Comentarios
COMMENT ON TABLE whatsapp_sessions IS 'Almacena credenciales de sesión de WhatsApp (Baileys auth state)';
COMMENT ON TABLE whatsapp_connection_status IS 'Estado actual de la conexión de WhatsApp';
COMMENT ON TABLE whatsapp_messages_log IS 'Log de mensajes enviados por WhatsApp para auditoría';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT * FROM whatsapp_sessions;
-- SELECT * FROM whatsapp_connection_status;
-- SELECT * FROM whatsapp_messages_log;
