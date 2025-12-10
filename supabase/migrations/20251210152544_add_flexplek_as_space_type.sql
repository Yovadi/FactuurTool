/*
  # Flexplek als Ruimte Type Toevoegen

  1. Wijzigingen
    - Voeg 'Flexplek' toe als space_type optie in office_spaces
    - Voeg Flexplek terug toe aan space_type_rates
    
  2. Notities
    - Dit maakt het mogelijk om dedicated Flexplekken aan te maken
    - De is_flex_space checkbox blijft beschikbaar voor andere ruimte types
    - Twee manieren: dedicated Flexplek OF andere ruimte met flex optie
*/

-- Voeg 'Flexplek' toe aan space_type check constraint
DO $$
BEGIN
  ALTER TABLE office_spaces DROP CONSTRAINT IF EXISTS office_spaces_space_type_check;
  
  ALTER TABLE office_spaces ADD CONSTRAINT office_spaces_space_type_check
    CHECK (space_type IN ('bedrijfsruimte', 'kantoor', 'buitenterrein', 'diversen', 'voorschot', 'Meeting Room', 'Flexplek'));
END $$;

-- Voeg Flexplek terug toe aan space_type_rates
INSERT INTO space_type_rates (space_type, calculation_method, fixed_rate, description)
VALUES ('Flexplek', 'custom', 0, 'Dedicated flexplek - Flexibel werkplek met verschillende tariefmodellen')
ON CONFLICT (space_type) DO UPDATE SET
  description = 'Dedicated flexplek - Flexibel werkplek met verschillende tariefmodellen';
