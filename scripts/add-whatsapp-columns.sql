-- Add WhatsApp columns to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_config JSONB DEFAULT '{}'::jsonb;

-- Update existing company to have WhatsApp enabled
UPDATE companies 
SET whatsapp_enabled = true,
    whatsapp_config = '{"provider": "baileys", "auto_reconnect": true}'::jsonb
WHERE id = 15;

-- Add comment for documentation
COMMENT ON COLUMN companies.whatsapp_enabled IS 'Enable/disable WhatsApp integration for this company';
COMMENT ON COLUMN companies.whatsapp_config IS 'WhatsApp provider configuration (baileys settings, etc)';