/*
  # Add ALA Grouping to Meter Groups

  1. Changes to `meter_groups` Table
    - Add `ala_group` field - ALA (Aardlekautomaat) group identifier (e.g., 'ALA1', 'ALA2')
    - Remove UNIQUE constraint on group_number (multiple entries can have same K number under different ALAs)
    - Update location_type constraint to remove 'bedrijfshal' (K groups are only for offices)
    - Add new UNIQUE constraint on (ala_group, group_number, location_number) combination

  2. Migration Notes
    - Existing meter groups without ALA will get 'ALA1' as default
    - Bedrijfshal location type is removed from meter groups (K groups)
    - Multiple offices can now be assigned to the same K group under an ALA
    - The structure is: ALA -> K (groepenkast) -> Kantoor(en)
*/

-- Add ala_group column with default value for existing records
ALTER TABLE meter_groups
ADD COLUMN IF NOT EXISTS ala_group text DEFAULT 'ALA1';

-- Update existing records to have ALA1 if null
UPDATE meter_groups
SET ala_group = 'ALA1'
WHERE ala_group IS NULL;

-- Make ala_group NOT NULL after setting defaults
ALTER TABLE meter_groups
ALTER COLUMN ala_group SET NOT NULL;

-- Drop the old unique constraint on group_number
ALTER TABLE meter_groups
DROP CONSTRAINT IF EXISTS meter_groups_group_number_key;

-- Drop the old location number constraint
ALTER TABLE meter_groups
DROP CONSTRAINT IF EXISTS valid_meter_location_number;

-- Add new location constraint without bedrijfshal
ALTER TABLE meter_groups ADD CONSTRAINT valid_meter_location_number CHECK (
  (location_type = 'kantoor' AND location_number BETWEEN 1 AND 8) OR
  (location_type = 'eigen_gebruik' AND location_number IS NULL) OR
  (location_type IS NULL)
);

-- Update location_type check to remove bedrijfshal
ALTER TABLE meter_groups
DROP CONSTRAINT IF EXISTS meter_groups_location_type_check;

ALTER TABLE meter_groups
ADD CONSTRAINT meter_groups_location_type_check
CHECK (location_type IN ('kantoor', 'eigen_gebruik'));

-- Add unique constraint on combination of ala_group, group_number, and location_number
-- This ensures K1 under ALA1 is different from K1 under ALA2
-- And the same K group can have multiple offices
ALTER TABLE meter_groups
ADD CONSTRAINT meter_groups_ala_group_number_location_unique
UNIQUE(ala_group, group_number, location_number);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_meter_groups_ala ON meter_groups(ala_group);
CREATE INDEX IF NOT EXISTS idx_meter_groups_ala_group_number ON meter_groups(ala_group, group_number);
