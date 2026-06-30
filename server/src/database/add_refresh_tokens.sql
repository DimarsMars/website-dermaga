-- ============================================================
-- Migration: Create refresh_tokens table for server-side
-- refresh token rotation. Tokens are stored hashed (SHA-256),
-- can be revoked individually or per-user, and automatically
-- pruned when expired.
-- Idempotent: safe to re-run on existing databases (IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  user_type     VARCHAR(20) NOT NULL CHECK (user_type IN ('agen', 'petugas', 'admin')),
  token_hash    CHAR(64) NOT NULL,
  issued_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at    TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Lookup a token by its hash (used during refresh verification)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
  ON refresh_tokens(token_hash)
  WHERE revoked_at IS NULL;

-- Lookup all active tokens for a user (used by logout-all / change-password)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens(user_id, user_type)
  WHERE revoked_at IS NULL;

-- Index to scan & prune expired tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
  ON refresh_tokens(expires_at);