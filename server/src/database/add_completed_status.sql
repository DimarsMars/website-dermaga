-- Add 'completed' to status_request CHECK constraint
-- Run this on your existing database to allow the scheduler to set status_request = 'completed'

ALTER TABLE trx_booking DROP CONSTRAINT IF EXISTS trx_booking_status_request_check;
ALTER TABLE trx_booking ADD CONSTRAINT trx_booking_status_request_check 
  CHECK (status_request IN ('pending', 'approved', 'rejected', 'completed'));
