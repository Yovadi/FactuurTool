/*
  # Gemeubileerd veld toevoegen aan kantoren

  1. Wijzigingen
    - Voeg `is_furnished` (boolean) toe aan `office_spaces` tabel
    - Standaard waarde: false (niet gemeubileerd)
    - Dit veld is vooral relevant voor kantoren om te onderscheiden tussen gemeubileerde en niet-gemeubileerde ruimtes

  2. Notities
    - Dit veld wordt gebruikt om verschillende tarieven te kunnen hanteren voor gemeubileerde vs niet-gemeubileerde kantoren
*/

-- Voeg is_furnished kolom toe aan office_spaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'is_furnished'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN is_furnished boolean DEFAULT false;
  END IF;
END $$;

-- Voeg commentaar toe voor duidelijkheid
COMMENT ON COLUMN office_spaces.is_furnished IS 'Geeft aan of de ruimte gemeubileerd is (vooral relevant voor kantoren)';
