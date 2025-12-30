/*
  # Add automatic rate selection to meeting room bookings

  1. Changes
    - Add `rate_type` column to track which rate was applied (hourly, half_day, full_day)
    - Add `applied_rate` column to store the actual rate used for calculation
  
  2. Rate Logic
    - hourly: less than 4 hours, charged per hour
    - half_day: 4 to 7 hours, fixed half-day rate
    - full_day: 8+ hours, fixed full-day rate
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_room_bookings' AND column_name = 'rate_type'
  ) THEN
    ALTER TABLE meeting_room_bookings ADD COLUMN rate_type text DEFAULT 'hourly';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_room_bookings' AND column_name = 'applied_rate'
  ) THEN
    ALTER TABLE meeting_room_bookings ADD COLUMN applied_rate numeric(10,2);
  END IF;
END $$;

ALTER TABLE meeting_room_bookings 
DROP CONSTRAINT IF EXISTS meeting_room_bookings_rate_type_check;

ALTER TABLE meeting_room_bookings 
ADD CONSTRAINT meeting_room_bookings_rate_type_check 
CHECK (rate_type IN ('hourly', 'half_day', 'full_day'));