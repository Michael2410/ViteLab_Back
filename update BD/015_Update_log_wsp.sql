ALTER TABLE whatsapp_messages_log 
ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);
