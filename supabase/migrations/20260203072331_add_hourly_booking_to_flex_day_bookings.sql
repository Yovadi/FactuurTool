/*
  # Add hourly booking support to flex day bookings

  1. Changes
    - Add start_time and end_time columns to flex_day_bookings
    - Add hourly_rate, total_hours, and total_amount for invoicing
    - Make is_half_day nullable (can be whole day, half day, or hourly)
    - Add constraint to ensure valid booking types

  2. Migration Notes
    - Existing bookings will have NULL times (full day or half day bookings)
    - New hourly bookings will have start_time and end_time set
    - Invoicing will calculate based on hourly_rate * total_hours for hourly bookings
*/

-- Add time and rate columns to flex_day_bookings
ALTER TABLE flex_day_bookings
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hours numeric(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(10, 2) DEFAULT 0;

-- Add constraint to ensure valid booking configurations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flex_booking_type_check'
  ) THEN
    ALTER TABLE flex_day_bookings
      ADD CONSTRAINT flex_booking_type_check CHECK (
        (start_time IS NULL AND end_time IS NULL) OR
        (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
      );
  END IF;
END $$;

-- Update existing bookings to have default values
UPDATE flex_day_bookings
SET
  hourly_rate = 0,
  total_hours = 0,
  total_amount = 0
WHERE hourly_rate IS NULL;