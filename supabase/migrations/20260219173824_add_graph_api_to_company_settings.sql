/*
  # Microsoft Graph API velden toevoegen aan company_settings

  ## Wijzigingen
  - Nieuwe kolommen voor Microsoft Graph API integratie:
    - `graph_enabled` (boolean) - of Graph API ingeschakeld is
    - `graph_tenant_id` (text) - Azure Tenant ID / Directory ID
    - `graph_client_id` (text) - Azure App Client ID
    - `graph_client_secret` (text) - Azure App Client Secret
    - `graph_from_email` (text) - Het e-mailadres waarvandaan verstuurd wordt (de mailbox)
    - `graph_from_name` (text) - Weergavenaam van de afzender
    - `graph_connected` (boolean) - of de verbinding getest en succesvol was

  ## Toelichting
  Microsoft Graph API is de moderne vervanging voor SMTP voor Microsoft 365.
  Vereist een Azure App Registration met Mail.Send permissie.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'graph_enabled'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN graph_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'graph_tenant_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN graph_tenant_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'graph_client_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN graph_client_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'graph_client_secret'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN graph_client_secret text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'graph_from_email'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN graph_from_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'graph_from_name'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN graph_from_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'graph_connected'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN graph_connected boolean NOT NULL DEFAULT false;
  END IF;
END $$;
