/*
  # Update Space Types

  1. Changes
    - Update the space_type enum to include new types: bedrijfsruimte, kantoor, buitenterrein, diversen, voorschot
    - Remove old types: hal
  
  2. Notes
    - Existing 'kantoor' type remains unchanged
    - Existing 'hal' records will be migrated to 'diversen'
*/

-- First, update any existing 'hal' records to 'diversen'
UPDATE office_spaces 
SET space_type = 'diversen' 
WHERE space_type = 'hal';

-- Drop the old constraint
ALTER TABLE office_spaces 
DROP CONSTRAINT IF EXISTS office_spaces_space_type_check;

-- Add new constraint with updated types
ALTER TABLE office_spaces 
ADD CONSTRAINT office_spaces_space_type_check 
CHECK (space_type IN ('bedrijfsruimte', 'kantoor', 'buitenterrein', 'diversen', 'voorschot'));