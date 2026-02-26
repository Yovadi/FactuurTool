/*
  # Add customizable email template fields to company_settings

  1. Modified Tables
    - `company_settings`
      - `email_subject_template` (text) - Custom subject line template for invoice emails
      - `email_greeting_template` (text) - Custom greeting/opening text
      - `email_body_template` (text) - Custom body text after the greeting
      - `email_payment_text` (text) - Custom text before payment details
      - `email_closing_template` (text) - Custom closing text
      - `email_signature_template` (text) - Custom signature text

  2. Notes
    - All fields are nullable with no defaults, so the app will fall back to existing hardcoded templates when empty
    - Users can use placeholders like {naam}, {factuurnummer}, {bedrijfsnaam}, {bedrag}, {factuurdatum}, {vervaldatum}, {iban}
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_subject_template'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_subject_template text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_greeting_template'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_greeting_template text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_body_template'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_body_template text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_payment_text'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_payment_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_closing_template'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_closing_template text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_signature_template'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_signature_template text;
  END IF;
END $$;
