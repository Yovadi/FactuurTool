/*
  # Flexplek als Ruimte Eigenschap

  1. Wijzigingen
    - Voeg `is_flex_space` boolean veld toe aan office_spaces
    - Elke ruimte kan nu als flexplek aangeboden worden
    - Verwijder 'Flexplek' uit space_type check constraint
    - Verwijder Flexplek uit space_type_rates (niet meer nodig)

  2. Notities
    - Dit maakt het flexibeler: dezelfde ruimte kan zowel fulltime als flex verhuurd worden
    - Bestaande flex leases blijven werken
*/

-- Voeg is_flex_space veld toe aan office_spaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'office_spaces' AND column_name = 'is_flex_space'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN is_flex_space boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Update alle bestaande 'Flexplek' ruimtes naar is_flex_space = true
UPDATE office_spaces 
SET is_flex_space = true 
WHERE space_type = 'Flexplek';

-- Pas space_type aan voor Flexplek ruimtes naar 'kantoor' (default)
UPDATE office_spaces 
SET space_type = 'kantoor' 
WHERE space_type = 'Flexplek';

-- Verwijder 'Flexplek' uit space_type check constraint
DO $$
BEGIN
  ALTER TABLE office_spaces DROP CONSTRAINT IF EXISTS office_spaces_space_type_check;
  
  ALTER TABLE office_spaces ADD CONSTRAINT office_spaces_space_type_check
    CHECK (space_type IN ('bedrijfsruimte', 'kantoor', 'buitenterrein', 'diversen', 'voorschot', 'Meeting Room'));
END $$;

-- Verwijder Flexplek uit space_type_rates
DELETE FROM space_type_rates WHERE space_type = 'Flexplek';

-- Voeg commentaar toe
COMMENT ON COLUMN office_spaces.is_flex_space IS 'Geeft aan of deze ruimte beschikbaar is als flexplek';
