/*
  # Remove Resend API Key from Company Settings

  1. Changes
    - Drop the `resend_api_key` column from `company_settings` table
  
  2. Notes
    - This removes the Resend email integration that is no longer needed
    - Uses IF EXISTS to safely handle column removal
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'resend_api_key'
  ) THEN
    ALTER TABLE company_settings DROP COLUMN resend_api_key;
  END IF;
END $$;
