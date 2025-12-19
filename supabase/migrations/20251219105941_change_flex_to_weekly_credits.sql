/*
  # Change flex contracts from monthly to weekly credits
  
  1. Changes
    - Rename `credits_per_month` column to `credits_per_week` in leases table
    - Update any existing flex leases to have a reasonable weekly credit amount
    - Keep flex_day_bookings table unchanged as it stores individual day bookings
  
  2. Notes
    - Existing monthly credits will be divided by ~4.3 to get weekly equivalent
    - This maintains roughly the same capacity but on a weekly basis
*/

-- Rename the column from credits_per_month to credits_per_week
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'credits_per_month'
  ) THEN
    -- First, convert existing monthly values to weekly (divide by 4.3)
    UPDATE leases
    SET credits_per_month = ROUND(credits_per_month / 4.3)
    WHERE lease_type = 'flex' AND credits_per_month IS NOT NULL;
    
    -- Then rename the column
    ALTER TABLE leases RENAME COLUMN credits_per_month TO credits_per_week;
  END IF;
END $$;