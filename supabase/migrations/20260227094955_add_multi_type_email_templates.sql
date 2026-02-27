/*
  # Add multi-type email templates to company_settings

  1. Modified Tables
    - `company_settings`
      - `email_template_invoice` (text) - Full email body template for invoice emails
      - `email_template_reminder` (text) - Full email body template for payment reminder emails
      - `email_template_credit_note` (text) - Full email body template for credit note emails
      - `email_subject_reminder` (text) - Subject line template for reminder emails
      - `email_subject_credit_note` (text) - Subject line template for credit note emails

  2. Notes
    - All fields are nullable; the app falls back to built-in defaults when empty
    - Existing email_subject_template is kept and used for invoice subject
    - Templates support placeholders: {naam}, {factuurnummer}, {bedrijfsnaam}, {bedrag}, {factuurdatum}, {vervaldatum}, {iban}
    - Credit note templates also support: {creditnotanummer}, {reden}
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_template_invoice'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_template_invoice text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_template_reminder'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_template_reminder text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_template_credit_note'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_template_credit_note text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_subject_reminder'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_subject_reminder text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'email_subject_credit_note'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN email_subject_credit_note text;
  END IF;
END $$;
