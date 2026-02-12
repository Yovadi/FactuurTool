/*
  # e-Boekhouden Integration Fields

  1. Modified Tables
    - `company_settings`
      - `eboekhouden_api_token` (text, nullable) - API token for e-Boekhouden REST API
      - `eboekhouden_connected` (boolean, default false) - whether the connection is verified
    - `tenants`
      - `eboekhouden_relatie_id` (integer, nullable) - linked relation ID in e-Boekhouden
    - `external_customers`
      - `eboekhouden_relatie_id` (integer, nullable) - linked relation ID in e-Boekhouden
    - `invoices`
      - `eboekhouden_factuur_id` (integer, nullable) - linked invoice ID in e-Boekhouden
      - `eboekhouden_synced_at` (timestamptz, nullable) - last sync timestamp
    - `credit_notes`
      - `eboekhouden_id` (integer, nullable) - linked ID in e-Boekhouden
      - `eboekhouden_synced_at` (timestamptz, nullable) - last sync timestamp

  2. New Tables
    - `eboekhouden_grootboek_mapping` - maps local categories to e-Boekhouden ledger accounts
      - `id` (uuid, primary key)
      - `local_category` (text) - category in this app (e.g. 'huur', 'vergaderruimte', etc.)
      - `grootboek_code` (text) - ledger account code in e-Boekhouden
      - `grootboek_omschrijving` (text) - description from e-Boekhouden
      - `btw_code` (text, nullable) - VAT code in e-Boekhouden (e.g. HOOG_VERK_21)
    - `eboekhouden_sync_log` - tracks sync operations for audit/troubleshooting
      - `id` (uuid, primary key)
      - `entity_type` (text) - what was synced (invoice, credit_note, relation)
      - `entity_id` (uuid) - local record ID
      - `eboekhouden_id` (integer, nullable) - remote ID
      - `action` (text) - what happened (create, update, error)
      - `status` (text) - success or error
      - `error_message` (text, nullable) - error details if failed
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on new tables
    - Policies for anon access (matching existing app pattern)

  4. Important Notes
    - All changes are purely additive - no existing columns or tables are modified
    - Existing functionality is completely unaffected
    - All new columns are nullable with safe defaults
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'eboekhouden_api_token'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN eboekhouden_api_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'eboekhouden_connected'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN eboekhouden_connected boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'eboekhouden_relatie_id'
  ) THEN
    ALTER TABLE tenants ADD COLUMN eboekhouden_relatie_id integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_customers' AND column_name = 'eboekhouden_relatie_id'
  ) THEN
    ALTER TABLE external_customers ADD COLUMN eboekhouden_relatie_id integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'eboekhouden_factuur_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN eboekhouden_factuur_id integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'eboekhouden_synced_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN eboekhouden_synced_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_notes' AND column_name = 'eboekhouden_id'
  ) THEN
    ALTER TABLE credit_notes ADD COLUMN eboekhouden_id integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_notes' AND column_name = 'eboekhouden_synced_at'
  ) THEN
    ALTER TABLE credit_notes ADD COLUMN eboekhouden_synced_at timestamptz;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS eboekhouden_grootboek_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_category text NOT NULL,
  grootboek_code text NOT NULL,
  grootboek_omschrijving text NOT NULL DEFAULT '',
  btw_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(local_category)
);

ALTER TABLE eboekhouden_grootboek_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on grootboek mapping"
  ON eboekhouden_grootboek_mapping
  FOR SELECT
  TO anon
  USING (true = true);

CREATE POLICY "Allow anon insert on grootboek mapping"
  ON eboekhouden_grootboek_mapping
  FOR INSERT
  TO anon
  WITH CHECK (true = true);

CREATE POLICY "Allow anon update on grootboek mapping"
  ON eboekhouden_grootboek_mapping
  FOR UPDATE
  TO anon
  USING (true = true)
  WITH CHECK (true = true);

CREATE POLICY "Allow anon delete on grootboek mapping"
  ON eboekhouden_grootboek_mapping
  FOR DELETE
  TO anon
  USING (true = true);

CREATE TABLE IF NOT EXISTS eboekhouden_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  eboekhouden_id integer,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eboekhouden_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on sync log"
  ON eboekhouden_sync_log
  FOR SELECT
  TO anon
  USING (true = true);

CREATE POLICY "Allow anon insert on sync log"
  ON eboekhouden_sync_log
  FOR INSERT
  TO anon
  WITH CHECK (true = true);
