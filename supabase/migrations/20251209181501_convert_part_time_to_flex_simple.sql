/*
  # Converteer Deeltijd naar Flex

  1. Wijzigingen
    - Update alle 'part_time' leases naar 'flex' type
    - Hernoem part_time_days_per_month naar flex_days_per_month in leases
    - Update check constraint voor lease_type (alleen full_time en flex)

  2. Notities
    - Bestaande deeltijd data blijft behouden maar wordt flex
    - Flex wordt het uniforme systeem voor flexibel gebruik
    - Deeltijd functionaliteit wordt samengevoegd met flex
*/

-- Update bestaande part_time leases naar flex
UPDATE leases 
SET lease_type = 'flex' 
WHERE lease_type = 'part_time';

-- Hernoem de kolom part_time_days_per_month naar flex_days_per_month
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'part_time_days_per_month'
  ) THEN
    ALTER TABLE leases RENAME COLUMN part_time_days_per_month TO flex_days_per_month;
  END IF;
END $$;

-- Update lease_type check constraint
DO $$
BEGIN
  ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_lease_type_check;
  
  ALTER TABLE leases ADD CONSTRAINT leases_lease_type_check
    CHECK (lease_type IN ('full_time', 'flex'));
END $$;

-- Update comment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'flex_days_per_month'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN leases.flex_days_per_month IS ''Aantal dagen per maand voor flex leases (bij credit_based model)''';
  END IF;
END $$;
