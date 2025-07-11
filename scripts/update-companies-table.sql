-- Add missing fields to companies table for YClients sync
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS coordinate_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS coordinate_lon DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}';

-- Update existing name column to use title
UPDATE companies SET title = name WHERE title IS NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_yclients_id ON companies(yclients_id);