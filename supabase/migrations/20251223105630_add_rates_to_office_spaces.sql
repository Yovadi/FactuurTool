/*
  # Add rate fields to office_spaces table

  1. Changes
    - Add `rate_per_sqm` column to office_spaces (for per m² pricing)
    - Add `daily_rate` column to office_spaces (for daily/hourly pricing like flex and meeting rooms)
    - Make rate_per_sqm optional (nullable) as not all space types use per m² pricing
    - Make daily_rate optional (nullable) as not all space types use daily pricing

  2. Explanation
    Instead of managing rates in a separate space_type_rates table, each office space 
    will now have its own rate directly associated with it. This makes it easier to:
    - Set custom rates for furnished vs unfurnished offices
    - Manage different rates for similar space types
    - Quickly see and update the rate when managing spaces
*/

-- Add rate columns to office_spaces table
DO $$
BEGIN
  -- Add rate_per_sqm column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'rate_per_sqm'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN rate_per_sqm decimal(10,2);
  END IF;

  -- Add daily_rate column if it doesn't exist (already exists as hourly_rate but we'll keep both)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'daily_rate'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN daily_rate decimal(10,2);
  END IF;
END $$;