-- ============================================================
-- Migration: Add extend time columns to trx_booking
-- Run this migration to support the "Extend Time" feature
-- ============================================================

-- Add extend_status column to track extend request state
ALTER TABLE trx_booking
ADD COLUMN IF NOT EXISTS extend_status VARCHAR(20) DEFAULT NULL
CHECK (extend_status IN ('pending', 'approved', 'rejected'));

-- Add extend_etd_out column to store the requested new departure time
ALTER TABLE trx_booking
ADD COLUMN IF NOT EXISTS extend_etd_out TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for finding pending extend requests
CREATE INDEX IF NOT EXISTS idx_trx_booking_extend_status ON trx_booking(extend_status);
