/*
  # Add Slot Number Support to Flex Bookings

  1. Changes
    - Add `slot_number` column to `flex_day_bookings` to track specific workspace slot within a flex space
    - Add `slot_number` column to `flex_schedules` for recurring flex contracts
    - Add partial unique index to prevent double booking of the same slot
    - Add index for performance

  2. Details
    - `slot_number` is nullable for backwards compatibility with existing bookings
    - Each flex space can have multiple slots (1 to flex_capacity)
    - Partial unique index ensures no double booking of same slot on same day
    - This enables resource planning view showing individual desk assignments
*/

-- Add slot_number to flex_day_bookings
ALTER TABLE flex_day_bookings
ADD COLUMN IF NOT EXISTS slot_number integer;

-- Add slot_number to flex_schedules
ALTER TABLE flex_schedules
ADD COLUMN IF NOT EXISTS slot_number integer;

-- Add comment explaining the column
COMMENT ON COLUMN flex_day_bookings.slot_number IS 'The specific slot/desk number within the flex space (1 to flex_capacity)';
COMMENT ON COLUMN flex_schedules.slot_number IS 'The specific slot/desk number within the flex space (1 to flex_capacity)';

-- Create partial unique index for slot booking on same day
-- Only one booking per space/slot/date combination (when slot_number is not null)
CREATE UNIQUE INDEX IF NOT EXISTS unique_flex_slot_booking
ON flex_day_bookings(space_id, slot_number, booking_date)
WHERE slot_number IS NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_flex_day_bookings_space_slot
ON flex_day_bookings(space_id, slot_number, booking_date);

-- Add check constraint to ensure slot_number is valid (positive integer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_slot_number_positive'
  ) THEN
    ALTER TABLE flex_day_bookings
    ADD CONSTRAINT check_slot_number_positive
    CHECK (slot_number > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_flex_schedule_slot_positive'
  ) THEN
    ALTER TABLE flex_schedules
    ADD CONSTRAINT check_flex_schedule_slot_positive
    CHECK (slot_number > 0);
  END IF;
END $$;

-- Create a function to get available slots for a specific date and space
CREATE OR REPLACE FUNCTION get_available_flex_slots(
  p_space_id uuid,
  p_booking_date date
)
RETURNS TABLE(slot_number integer) AS $$
DECLARE
  v_capacity integer;
BEGIN
  -- Get the flex capacity for this space
  SELECT flex_capacity INTO v_capacity
  FROM office_spaces
  WHERE id = p_space_id;

  -- If no capacity set, return empty
  IF v_capacity IS NULL THEN
    RETURN;
  END IF;

  -- Generate all possible slot numbers
  RETURN QUERY
  SELECT generate_series(1, v_capacity)::integer
  EXCEPT
  -- Subtract slots already booked for this date
  SELECT fdb.slot_number
  FROM flex_day_bookings fdb
  WHERE fdb.space_id = p_space_id
    AND fdb.booking_date = p_booking_date
    AND fdb.slot_number IS NOT NULL
  EXCEPT
  -- Subtract slots with recurring schedules for this day of week
  SELECT fs.slot_number
  FROM flex_schedules fs
  WHERE fs.space_id = p_space_id
    AND fs.slot_number IS NOT NULL
    AND (
      (EXTRACT(DOW FROM p_booking_date) = 1 AND fs.monday) OR
      (EXTRACT(DOW FROM p_booking_date) = 2 AND fs.tuesday) OR
      (EXTRACT(DOW FROM p_booking_date) = 3 AND fs.wednesday) OR
      (EXTRACT(DOW FROM p_booking_date) = 4 AND fs.thursday) OR
      (EXTRACT(DOW FROM p_booking_date) = 5 AND fs.friday)
    );
END;
$$ LANGUAGE plpgsql;