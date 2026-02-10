/*
  # Add Assignment Type to Building Resources

  1. Changes
    - Add `assignment_type` column to wifi_networks, patch_ports, meter_groups, and rcbo_circuit_breakers
    - Values: 'eigen' (default), 'huurder', 'spreekkamer', 'flexplek'
    - When type is 'huurder', tenant_id must be set
    - When type is 'eigen', 'spreekkamer', or 'flexplek', tenant_id should be NULL
  
  2. Data Migration
    - Set assignment_type based on existing tenant_id values
    - If tenant_id is NULL, set to 'eigen'
    - If tenant_id is set, set to 'huurder'
  
  3. Important Notes
    - This enables proper color coding for spreekkamer and flexplek
    - Maintains backward compatibility with existing data
*/

-- Add assignment_type column to wifi_networks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wifi_networks' AND column_name = 'assignment_type'
  ) THEN
    ALTER TABLE wifi_networks 
      ADD COLUMN assignment_type text DEFAULT 'eigen' CHECK (assignment_type IN ('eigen', 'huurder', 'spreekkamer', 'flexplek'));
  END IF;
END $$;

-- Add assignment_type column to patch_ports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patch_ports' AND column_name = 'assignment_type'
  ) THEN
    ALTER TABLE patch_ports 
      ADD COLUMN assignment_type text DEFAULT 'eigen' CHECK (assignment_type IN ('eigen', 'huurder', 'spreekkamer', 'flexplek'));
  END IF;
END $$;

-- Add assignment_type column to meter_groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meter_groups' AND column_name = 'assignment_type'
  ) THEN
    ALTER TABLE meter_groups 
      ADD COLUMN assignment_type text DEFAULT 'eigen' CHECK (assignment_type IN ('eigen', 'huurder', 'spreekkamer', 'flexplek'));
  END IF;
END $$;

-- Add assignment_type column to rcbo_circuit_breakers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rcbo_circuit_breakers' AND column_name = 'assignment_type'
  ) THEN
    ALTER TABLE rcbo_circuit_breakers 
      ADD COLUMN assignment_type text DEFAULT 'eigen' CHECK (assignment_type IN ('eigen', 'huurder', 'spreekkamer', 'flexplek'));
  END IF;
END $$;

-- Migrate existing wifi_networks data
UPDATE wifi_networks 
SET assignment_type = CASE 
  WHEN tenant_id IS NOT NULL THEN 'huurder' 
  ELSE 'eigen' 
END
WHERE assignment_type = 'eigen';

-- Migrate existing patch_ports data
UPDATE patch_ports 
SET assignment_type = CASE 
  WHEN tenant_id IS NOT NULL THEN 'huurder' 
  ELSE 'eigen' 
END
WHERE assignment_type = 'eigen';

-- Migrate existing meter_groups data
UPDATE meter_groups 
SET assignment_type = CASE 
  WHEN tenant_id IS NOT NULL THEN 'huurder' 
  ELSE 'eigen' 
END
WHERE assignment_type = 'eigen';

-- Migrate existing rcbo_circuit_breakers data
UPDATE rcbo_circuit_breakers 
SET assignment_type = CASE 
  WHEN tenant_id IS NOT NULL THEN 'huurder' 
  ELSE 'eigen' 
END
WHERE assignment_type = 'eigen';