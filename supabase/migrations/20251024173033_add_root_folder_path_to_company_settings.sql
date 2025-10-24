/*
  # Add root folder path to company settings

  1. Changes
    - Add `root_folder_path` column to `company_settings` table
      - Stores the root folder path where tenant folders and invoices will be saved
      - Optional field (can be null if not configured)

  2. Notes
    - This allows users to specify where invoice PDFs should be automatically saved
    - Each tenant will have their own subfolder within this root path
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'root_folder_path'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN root_folder_path text;
  END IF;
END $$;