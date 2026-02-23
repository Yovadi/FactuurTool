/*
  # Add OneDrive settings to company_settings

  1. Modified Tables
    - `company_settings`
      - `onedrive_enabled` (boolean) - Whether OneDrive sync is enabled
      - `onedrive_folder_path` (text) - Target folder path in OneDrive (e.g. "Facturen")
      - `onedrive_user_email` (text) - The OneDrive user email to upload files to

  2. Notes
    - Uses the existing Graph API credentials (graph_tenant_id, graph_client_id, graph_client_secret) for authentication
    - The Graph API app registration needs Files.ReadWrite.All permission in Azure AD
    - Files are uploaded to the specified user's OneDrive
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'onedrive_enabled'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN onedrive_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'onedrive_folder_path'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN onedrive_folder_path text DEFAULT 'Facturen';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'onedrive_user_email'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN onedrive_user_email text;
  END IF;
END $$;
