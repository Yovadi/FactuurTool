/*
  # Voeg Huurder Toewijzing toe aan Groepen en Poorten

  ## Wijzigingen
  1. Voeg `tenant_id` toe aan `meter_groups`
     - Hiermee kunnen groepen direct aan huurders gekoppeld worden
     - NULL waarde betekent "Eigen gebruik" (verhuurder)
  2. Voeg `tenant_id` toe aan `patch_ports`
     - Hiermee kunnen poorten direct aan huurders gekoppeld worden
     - NULL waarde betekent "Eigen gebruik" (verhuurder)
  3. Verwijder oude location_type en location_number velden
     - Deze worden vervangen door directe huurder koppeling
  
  ## Beschrijving
  Deze migratie maakt het mogelijk om:
  - Meterkast groepen (K1, K2, etc.) direct aan huurders toe te wijzen
  - Patchkast poorten direct aan huurders toe te wijzen
  - Eigen gebruik (verhuurder) aan te geven met NULL tenant_id
  - Kleurgecodeerde weergave per huurder
  
  ## Beveiliging
  - Bestaande RLS policies blijven van kracht
  - Foreign key constraints zorgen voor data integriteit
*/

-- Add tenant_id to meter_groups
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meter_groups' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE meter_groups 
      ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add tenant_id to patch_ports
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patch_ports' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE patch_ports 
      ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop old location columns from meter_groups (if they exist)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meter_groups' AND column_name = 'location_type'
  ) THEN
    ALTER TABLE meter_groups DROP COLUMN IF EXISTS location_type;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meter_groups' AND column_name = 'location_number'
  ) THEN
    ALTER TABLE meter_groups DROP COLUMN IF EXISTS location_number;
  END IF;
END $$;

-- Drop old location columns from patch_ports (if they exist)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patch_ports' AND column_name = 'location_type'
  ) THEN
    ALTER TABLE patch_ports DROP COLUMN IF EXISTS location_type;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patch_ports' AND column_name = 'location_number'
  ) THEN
    ALTER TABLE patch_ports DROP COLUMN IF EXISTS location_number;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meter_groups_tenant_id ON meter_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patch_ports_tenant_id ON patch_ports(tenant_id);