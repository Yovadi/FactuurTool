/*
  # Add Meeting Room to space_type check constraint

  1. Changes
    - Drop existing space_type check constraint
    - Add new constraint that includes 'Meeting Room' as valid space type
  
  2. Valid Space Types
    - bedrijfsruimte (business space)
    - kantoor (office)
    - buitenterrein (outdoor area)
    - diversen (miscellaneous)
    - voorschot (advance payment)
    - Meeting Room (meeting room)
*/

-- Drop the existing constraint
ALTER TABLE office_spaces DROP CONSTRAINT IF EXISTS office_spaces_space_type_check;

-- Add new constraint with Meeting Room included
ALTER TABLE office_spaces ADD CONSTRAINT office_spaces_space_type_check 
  CHECK (space_type = ANY (ARRAY['bedrijfsruimte'::text, 'kantoor'::text, 'buitenterrein'::text, 'diversen'::text, 'voorschot'::text, 'Meeting Room'::text]));
