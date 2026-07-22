-- Link activity history to a booking for booking-specific filtering.
-- No foreign key is used so activity history survives booking deletion.

ALTER TABLE log_activity
ADD COLUMN IF NOT EXISTS id_booking INTEGER;

CREATE INDEX IF NOT EXISTS idx_log_activity_id_booking
ON log_activity(id_booking);