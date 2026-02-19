/*
  # Add Resend email integration to company_settings

  ## Summary
  Adds support for Resend.com as an email sending provider.

  ## New Columns on company_settings
  - `resend_enabled` (boolean) - Whether the Resend integration is active
  - `resend_api_key` (text) - The Resend API key
  - `resend_from_email` (text) - Sender email address (must be verified in Resend)
  - `resend_from_name` (text) - Display name for sender
  - `resend_connected` (boolean) - Whether a successful test has been performed

  ## Notes
  - All columns added conditionally to prevent errors on re-run
  - No RLS changes needed; inherits existing company_settings policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'resend_enabled'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN resend_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'resend_api_key'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN resend_api_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'resend_from_email'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN resend_from_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'resend_from_name'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN resend_from_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'resend_connected'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN resend_connected boolean NOT NULL DEFAULT false;
  END IF;
END $$;
