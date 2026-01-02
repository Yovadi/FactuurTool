/*
  # Add Tenant Association to WiFi Networks

  1. Changes to `wifi_networks` table
    - Add `tenant_id` (uuid, nullable, foreign key to tenants table)
    - WiFi networks can optionally be associated with a tenant
  
  2. Security
    - No changes to RLS policies needed (still anonymous access)
  
  3. Important Notes
    - Tenant association is optional (nullable field)
    - Foreign key ensures data integrity
    - On tenant delete, the tenant_id is set to NULL (network remains)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wifi_networks' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE wifi_networks ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wifi_networks_tenant_id ON wifi_networks(tenant_id);
