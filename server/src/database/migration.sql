-- ============================================================
-- Dock Pre-Booking Monitoring System - Database Migration
-- PostgreSQL Schema
-- ============================================================

-- Drop tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS notifikasi CASCADE;
DROP TABLE IF EXISTS log_activity CASCADE;
DROP TABLE IF EXISTS trx_booking CASCADE;
DROP TABLE IF EXISTS master_kapal CASCADE;
DROP TABLE IF EXISTS master_petugas CASCADE;
DROP TABLE IF EXISTS master_agen CASCADE;

-- ============================================================
-- Table: master_agen (Agent accounts)
-- ============================================================
CREATE TABLE master_agen (
  id_agen         SERIAL PRIMARY KEY,
  username        VARCHAR(50) UNIQUE NOT NULL,
  password        VARCHAR(255) NOT NULL,
  agency_name     VARCHAR(100) NOT NULL,
  npwp            VARCHAR(20),
  company_address TEXT,
  phone_number    VARCHAR(20),
  email           VARCHAR(100),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Table: master_petugas (Operational officers and admins)
-- ============================================================
CREATE TABLE master_petugas (
  id_petugas    SERIAL PRIMARY KEY,
  employee_id   VARCHAR(20) UNIQUE NOT NULL,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password      VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  phone_number  VARCHAR(20),
  user_role     VARCHAR(20) NOT NULL CHECK (user_role IN ('petugas', 'admin')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Table: master_kapal (Ship registry)
-- ============================================================
CREATE TABLE master_kapal (
  id_kapal      SERIAL PRIMARY KEY,
  id_agen       INTEGER NOT NULL REFERENCES master_agen(id_agen) ON DELETE RESTRICT,
  nama_kapal    VARCHAR(100) NOT NULL,
  loa           NUMERIC(6,2) NOT NULL,
  gt            NUMERIC(10,2),
  keterangan    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Table: trx_booking (Booking transactions)
-- ============================================================
CREATE TABLE trx_booking (
  id_booking      SERIAL PRIMARY KEY,
  id_kapal        INTEGER NOT NULL REFERENCES master_kapal(id_kapal) ON DELETE RESTRICT,
  id_agen         INTEGER NOT NULL REFERENCES master_agen(id_agen) ON DELETE RESTRICT,
  pos_start       NUMERIC(6,2) NOT NULL,
  pos_end         NUMERIC(6,2) NOT NULL,
  eta_in          TIMESTAMP WITH TIME ZONE NOT NULL,
  etd_out         TIMESTAMP WITH TIME ZONE NOT NULL,
  pbm             VARCHAR(100),
  keterangan      TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'inactive'
                  CHECK (status IN ('active', 'inactive')),
  status_request  VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status_request IN ('pending', 'approved', 'rejected', 'completed')),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Dock capacity constraint: positions must be within 0-500m range
  CONSTRAINT chk_pos_start CHECK (pos_start >= 0),
  CONSTRAINT chk_pos_end CHECK (pos_end <= 500)
);

-- ============================================================
-- Table: log_activity (Activity log)
-- ============================================================
CREATE TABLE log_activity (
  id_log          SERIAL PRIMARY KEY,
  id_user         INTEGER NOT NULL,
  user_type       VARCHAR(20) NOT NULL CHECK (user_type IN ('agen', 'petugas', 'admin')),
  date_time       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activity_type   VARCHAR(50) NOT NULL,
  keterangan      TEXT
);

-- ============================================================
-- Table: notifikasi (Notifications)
-- ============================================================
CREATE TABLE notifikasi (
  id_notif      SERIAL PRIMARY KEY,
  id_user       INTEGER NOT NULL,
  user_type     VARCHAR(20) NOT NULL CHECK (user_type IN ('agen', 'petugas', 'admin')),
  title         VARCHAR(100) NOT NULL,
  message       TEXT NOT NULL,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Indexes on frequently queried columns
-- ============================================================

-- Booking status filtering (pending/approved/rejected)
CREATE INDEX idx_trx_booking_status_request ON trx_booking(status_request);

-- Booking filtering by agent
CREATE INDEX idx_trx_booking_id_agen ON trx_booking(id_agen);

-- Temporal queries for overlap detection
CREATE INDEX idx_trx_booking_eta_in ON trx_booking(eta_in);
CREATE INDEX idx_trx_booking_etd_out ON trx_booking(etd_out);

-- Ship lookup by agent
CREATE INDEX idx_master_kapal_id_agen ON master_kapal(id_agen);

-- Notification lookup by user
CREATE INDEX idx_notifikasi_id_user ON notifikasi(id_user, user_type);
CREATE INDEX idx_notifikasi_is_read ON notifikasi(is_read);

-- Activity log lookup by user
CREATE INDEX idx_log_activity_id_user ON log_activity(id_user, user_type);
CREATE INDEX idx_log_activity_date_time ON log_activity(date_time);
