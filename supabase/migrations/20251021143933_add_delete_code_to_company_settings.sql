/*
  # Add delete_code field to company_settings

  1. Changes
    - Add `delete_code` column to `company_settings` table
      - `delete_code` (text, code required to delete paid invoices)
      - Default value: '1234'

  2. Notes
    - This code will be used to protect deletion of paid invoices
    - Can be customized by the company owner in settings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'delete_code'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN delete_code text DEFAULT '1234';
  END IF;
END $$;