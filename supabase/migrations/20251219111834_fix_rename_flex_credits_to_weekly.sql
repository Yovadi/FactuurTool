/*
  # Fix: Rename flex_credits_per_month to credits_per_week
  
  1. Changes
    - Rename `flex_credits_per_month` column to `credits_per_week` in leases table
    - Convert existing monthly values to weekly values (divide by ~4.3)
  
  2. Notes
    - The previous migration targeted the wrong column name
    - This fixes the correct column: flex_credits_per_month -> credits_per_week
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'flex_credits_per_month'
  ) THEN
    UPDATE leases
    SET flex_credits_per_month = ROUND(flex_credits_per_month / 4.3)
    WHERE lease_type = 'flex' AND flex_credits_per_month IS NOT NULL;
    
    ALTER TABLE leases RENAME COLUMN flex_credits_per_month TO credits_per_week;
  END IF;
END $$;