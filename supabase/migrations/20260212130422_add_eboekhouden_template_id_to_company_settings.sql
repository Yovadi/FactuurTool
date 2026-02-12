/*
  # Add e-Boekhouden invoice template ID to company settings

  1. Modified Tables
    - `company_settings`
      - `eboekhouden_template_id` (integer, nullable) - Stores the selected invoice template ID from e-Boekhouden

  2. Notes
    - The template ID is required by the e-Boekhouden API when creating invoices
    - Users select their preferred template from available templates in their e-Boekhouden account
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'eboekhouden_template_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN eboekhouden_template_id integer;
  END IF;
END $$;
