-- ============================================================
-- Migration: Add authentication columns for password reset feature
-- Adds `email` to master_petugas and `reset_token`/`reset_token_expires`
-- to both master_agen and master_petugas so the "Reset Password" flow works.
-- Idempotent: safe to re-run on existing databases (IF NOT EXISTS).
-- ============================================================

-- master_petugas: add email column (master_agen already has email from baseline migration)
ALTER TABLE master_petugas
ADD COLUMN IF NOT EXISTS email VARCHAR(100);

-- master_agen: add reset token columns
ALTER TABLE master_agen
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64),
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;

-- master_petugas: add reset token columns
ALTER TABLE master_petugas
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64),
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;

-- Index to accelerate token lookup during password reset confirmation
CREATE INDEX IF NOT EXISTS idx_master_agen_reset_token ON master_agen(reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_petugas_reset_token ON master_petugas(reset_token) WHERE reset_token IS NOT NULL;

-- Ensure email is unique per table (one account per email) so password reset
-- link resolves to a single account. NULL values are allowed (legacy rows).
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_agen_email ON master_agen(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_petugas_email ON master_petugas(email) WHERE email IS NOT NULL;