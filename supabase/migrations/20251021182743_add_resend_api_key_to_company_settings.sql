/*
  # Add Resend API Key to Company Settings

  ## Overview
  Add support for storing the Resend API key in company settings to enable email functionality.

  ## Changes
  1. Tables Modified
    - `company_settings`
      - Add `resend_api_key` column (text, nullable) for storing the Resend API key

  ## Security
  - No RLS changes needed as company_settings already has appropriate policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'resend_api_key'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN resend_api_key text;
  END IF;
END $$;
