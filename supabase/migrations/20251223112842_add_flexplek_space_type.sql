/*
  # Voeg Flexplek toe als ruimte type

  1. Changes
    - Voeg 'Flexplek' toe aan de allowed space types voor office_spaces
    - Dit maakt het mogelijk om ruimtes direct als type Flexplek aan te maken
    - Flexplek ruimtes hebben geen m² maar wel een capaciteit en dagtarief
*/

-- Update the space_type check constraint to include 'Flexplek'
ALTER TABLE office_spaces 
DROP CONSTRAINT IF EXISTS office_spaces_space_type_check;

ALTER TABLE office_spaces 
ADD CONSTRAINT office_spaces_space_type_check 
CHECK (space_type IN ('bedrijfsruimte', 'kantoor', 'buitenterrein', 'diversen', 'Meeting Room', 'Flexplek'));