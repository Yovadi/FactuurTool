/*
  # Add flex day type option

  1. Changes
    - Add `flex_day_type` column to `leases` table to specify if credits are for full days or half days
    - Default value is 'full_day' for existing records
  
  2. Notes
    - 'full_day' = 1 credit = 1 full day
    - 'half_day' = 1 credit = 0.5 day (so 2 credits per full day)
    - This allows flexers to have half-day credits for more flexibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'flex_day_type'
  ) THEN
    ALTER TABLE leases ADD COLUMN flex_day_type text DEFAULT 'full_day';
    ALTER TABLE leases ADD CONSTRAINT flex_day_type_check CHECK (flex_day_type IN ('full_day', 'half_day'));
  END IF;
END $$;

COMMENT ON COLUMN leases.flex_day_type IS 'Whether flex credits are for full days or half days';