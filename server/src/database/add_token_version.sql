-- ============================================================
-- Migration: Add token_version column for instant JWT invalidation
-- after a password change. The JWT payload carries the version
-- at issue time; the middleware rejects when it no longer matches.
-- Idempotent.
-- ============================================================

ALTER TABLE master_agen
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE master_petugas
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;