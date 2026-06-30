-- ============================================================
-- Dock Pre-Booking Monitoring System - Seed Data
-- ============================================================

-- Initial Admin account
-- Username: admin
-- Password: admin123 (bcrypt hashed with salt rounds = 12)
INSERT INTO master_petugas (employee_id, username, password, name, phone_number, user_role)
VALUES (
  'ADM001',
  'admin',
  '$2b$12$K1eNE9J22nngqA0MKDKJ2eEzOpNAjoETbQlds5BAHigB2v2IO8d46',
  'System Administrator',
  '081200000000',
  'admin'
)
ON CONFLICT (username) DO NOTHING;
