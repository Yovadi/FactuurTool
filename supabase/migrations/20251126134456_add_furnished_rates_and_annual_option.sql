/*
  # Uitbreiding tarieven met gemeubileerd en jaarlijks

  1. Wijzigingen aan space_type_rates
    - Voeg `rate_per_sqm_furnished` (numeric) toe - Prijs per m² voor gemeubileerde kantoren
    - Voeg `fixed_rate_furnished` (numeric) toe - Vast tarief voor gemeubileerde kantoren
    - Voeg `is_annual` (boolean) toe - Of het tarief jaarlijks is (gedeeld door 12 voor maandelijkse facturen)
    - Voeg `description_furnished` (text) toe - Beschrijving voor gemeubileerd tarief

  2. Notities
    - Voor kantoren kunnen nu aparte tarieven ingesteld worden voor gemeubileerd/niet-gemeubileerd
    - Bij is_annual = true wordt het bedrag automatisch gedeeld door 12 bij facturering
    - Andere ruimtetypes gebruiken alleen de standaard tarieven
*/

-- Voeg nieuwe kolommen toe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'rate_per_sqm_furnished'
  ) THEN
    ALTER TABLE space_type_rates ADD COLUMN rate_per_sqm_furnished numeric(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'fixed_rate_furnished'
  ) THEN
    ALTER TABLE space_type_rates ADD COLUMN fixed_rate_furnished numeric(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'is_annual'
  ) THEN
    ALTER TABLE space_type_rates ADD COLUMN is_annual boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'description_furnished'
  ) THEN
    ALTER TABLE space_type_rates ADD COLUMN description_furnished text;
  END IF;
END $$;

-- Voeg commentaren toe voor duidelijkheid
COMMENT ON COLUMN space_type_rates.rate_per_sqm_furnished IS 'Prijs per m² voor gemeubileerde kantoren';
COMMENT ON COLUMN space_type_rates.fixed_rate_furnished IS 'Vast tarief voor gemeubileerde kantoren';
COMMENT ON COLUMN space_type_rates.is_annual IS 'Of het tarief jaarlijks is (wordt gedeeld door 12 voor maandelijkse berekening)';
COMMENT ON COLUMN space_type_rates.description_furnished IS 'Beschrijving voor gemeubileerd tarief';
