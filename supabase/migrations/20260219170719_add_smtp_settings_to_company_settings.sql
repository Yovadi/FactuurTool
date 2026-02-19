/*
  # Add SMTP Settings to Company Settings

  ## Summary
  Adds SMTP email configuration fields to the company_settings table so users
  can configure their own mail server for sending invoices and other emails.

  ## New Columns
  - `smtp_host` - SMTP server hostname (e.g., smtp.office365.com)
  - `smtp_port` - SMTP server port number (e.g., 587)
  - `smtp_user` - SMTP username / email address used for authentication
  - `smtp_password` - SMTP password or app password (stored encrypted)
  - `smtp_from_name` - Display name for sent emails
  - `smtp_from_email` - From email address (may differ from smtp_user)
  - `smtp_enabled` - Toggle to enable/disable SMTP email sending
  - `smtp_connected` - Status flag indicating last test was successful

  ## Security
  - No new RLS changes needed; inherits existing company_settings policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'smtp_host'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_host text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'smtp_port'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_port integer DEFAULT 587;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'smtp_user'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_user text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'smtp_password'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_password text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'smtp_from_name'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_from_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'smtp_from_email'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_from_email text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'smtp_enabled'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'smtp_connected'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN smtp_connected boolean DEFAULT false;
  END IF;
END $$;
