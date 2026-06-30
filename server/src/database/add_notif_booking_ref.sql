-- Add related_booking_id to notifikasi table so notifications can link to a booking
-- (used for the "Extend Time" offer notification to know which booking to extend)

ALTER TABLE notifikasi
ADD COLUMN IF NOT EXISTS related_booking_id INTEGER DEFAULT NULL;
