/*
  # Add hourly_rate column to office_spaces table

  1. Changes
    - Add `hourly_rate` column to `office_spaces` table
      - Type: numeric(10,2) to store hourly rates for meeting rooms
      - Nullable: true (only meeting rooms need this field)
      - Default: null
  
  2. Notes
    - This column is used for Meeting Room space types
    - Allows flexible pricing per hour for meeting room bookings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN hourly_rate numeric(10,2) DEFAULT NULL;
  END IF;
END $$;
