/*
  # Add name field to company settings

  1. Changes
    - Add `name` column to `company_settings` table to store the name of the landlord/property manager
    - This allows storing a personal name alongside the company name
  
  2. Notes
    - Field is optional (nullable) to maintain backward compatibility
    - Existing records will have NULL for the name field initially
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'name'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN name text;
  END IF;
END $$;