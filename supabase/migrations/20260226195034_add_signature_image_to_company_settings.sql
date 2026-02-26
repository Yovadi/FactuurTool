/*
  # Add signature image to company settings

  1. Modified Tables
    - `company_settings`
      - `email_signature_image` (text, nullable) - Base64 encoded signature image for email footer
  
  2. Description
    - Allows uploading a logo/signature image that appears in the email signature
    - Stored as base64 text for inline embedding in HTML emails
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_signature_image'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_signature_image text;
  END IF;
END $$;
