-- Add type and call_sign columns to master_kapal
ALTER TABLE master_kapal ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE master_kapal ADD COLUMN IF NOT EXISTS call_sign VARCHAR(50);
