/*
  # Add Location Assignment to Patch Ports

  1. Changes to `patch_ports`
    - Add `location_type` (text) - Type of location: 'kantoor', 'bedrijfshal', or 'eigen_gebruik'
    - Add `location_number` (integer) - Number for office (1-8) or hall (1-4), null for own use
    - Rename `location_description` to `notes` for clarity
    - Update constraints to support multiple patch ports per location
  
  2. Migration Strategy
    - Add new columns with default values
    - Migrate existing data if needed
    - Remove old unique constraint to allow multiple ports per office
  
  3. Important Notes
    - Offices: 1-8
    - Business halls: 1-4
    - Own use: no number needed
    - Multiple patch ports can be assigned to the same location
*/

-- Add new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patch_ports' AND column_name = 'location_type'
  ) THEN
    ALTER TABLE patch_ports ADD COLUMN location_type text CHECK (location_type IN ('kantoor', 'bedrijfshal', 'eigen_gebruik'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patch_ports' AND column_name = 'location_number'
  ) THEN
    ALTER TABLE patch_ports ADD COLUMN location_number integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patch_ports' AND column_name = 'notes'
  ) THEN
    ALTER TABLE patch_ports ADD COLUMN notes text DEFAULT '';
  END IF;
END $$;

-- Add constraint for location_number based on location_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_location_number'
  ) THEN
    ALTER TABLE patch_ports ADD CONSTRAINT valid_location_number CHECK (
      (location_type = 'kantoor' AND location_number BETWEEN 1 AND 8) OR
      (location_type = 'bedrijfshal' AND location_number BETWEEN 1 AND 4) OR
      (location_type = 'eigen_gebruik' AND location_number IS NULL) OR
      (location_type IS NULL)
    );
  END IF;
END $$;

-- Migrate existing location_description to notes if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patch_ports' AND column_name = 'location_description'
  ) THEN
    UPDATE patch_ports SET notes = location_description WHERE location_description IS NOT NULL AND location_description != '';
    ALTER TABLE patch_ports DROP COLUMN location_description;
  END IF;
END $$;

-- Create index for efficient location lookups
CREATE INDEX IF NOT EXISTS idx_patch_ports_location ON patch_ports(location_type, location_number);
