/*
  # Add Test Mode to Company Settings

  1. Changes
    - Add `test_mode` boolean column to `company_settings` table (default false)
    - Add `test_date` date column to `company_settings` table for simulating the current date in test mode
  
  2. Purpose
    - Allow users to enable test mode and set a custom date for testing purposes
    - When test mode is enabled, the application will use the test_date instead of the current date
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'test_mode'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN test_mode boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'test_date'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN test_date date DEFAULT NULL;
  END IF;
END $$;