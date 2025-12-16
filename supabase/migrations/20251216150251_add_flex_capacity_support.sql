/*
  # Add Flex Capacity Support

  1. Changes
    - Add `flex_capacity` column to `office_spaces` table
    - Default capacity is 1 for existing spaces
    - Allows multiple people to book the same flex space simultaneously
  
  2. Notes
    - Only applies to flex spaces (is_flex_space = true)
    - Capacity determines how many concurrent bookings are allowed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'flex_capacity'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN flex_capacity integer DEFAULT 1;
  END IF;
END $$;

COMMENT ON COLUMN office_spaces.flex_capacity IS 'Number of people that can use this flex space simultaneously';