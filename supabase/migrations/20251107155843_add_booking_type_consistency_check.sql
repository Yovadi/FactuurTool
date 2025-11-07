-- Add booking_type consistency check
-- Ensures booking_type matches the actual customer type

ALTER TABLE meeting_room_bookings
ADD CONSTRAINT check_booking_type_consistency CHECK (
  (booking_type = 'tenant' AND tenant_id IS NOT NULL AND external_customer_id IS NULL) OR
  (booking_type = 'external' AND external_customer_id IS NOT NULL AND tenant_id IS NULL)
);
