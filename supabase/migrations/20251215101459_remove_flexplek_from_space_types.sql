/*
  # Verwijder Flexplek als Ruimte Type
  
  1. Wijzigingen
    - Verwijder bestaande "Flexplek" ruimtes
    - Verwijder "Flexplek" uit space_type_rates
    - Verwijder de daily_rate, punch_card_rate en punch_card_days kolommen (niet meer nodig)
    - Update space_type constraint op office_spaces
    - Flexplek wordt geen ruimte meer, maar een status op het huurcontract
    - Ruimtes kunnen worden gemarkeerd met is_flex_space om aan te geven dat ze beschikbaar zijn voor flex gebruik
  
  2. Notities
    - Flex tarieven worden volledig bepaald op huurcontract niveau
    - Flex huurders krijgen geen vaste ruimte toegewezen
    - Bestaande kantoren/bedrijfsruimtes kunnen worden gemarkeerd als "beschikbaar voor flex"
*/

-- Verwijder bestaande Flexplek ruimtes (alleen als er geen actieve leases zijn)
DELETE FROM office_spaces WHERE space_type = 'Flexplek';

-- Verwijder Flexplek uit space_type_rates
DELETE FROM space_type_rates WHERE space_type = 'Flexplek';

-- Verwijder de flex-specifieke kolommen (niet meer nodig voor ruimte types)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'daily_rate'
  ) THEN
    ALTER TABLE space_type_rates DROP COLUMN daily_rate;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'punch_card_rate'
  ) THEN
    ALTER TABLE space_type_rates DROP COLUMN punch_card_rate;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'punch_card_days'
  ) THEN
    ALTER TABLE space_type_rates DROP COLUMN punch_card_days;
  END IF;
END $$;

-- Update de calculation_method constraint (verwijder daily en punch_card)
ALTER TABLE space_type_rates 
  DROP CONSTRAINT IF EXISTS space_type_rates_calculation_method_check;

ALTER TABLE space_type_rates
  ADD CONSTRAINT space_type_rates_calculation_method_check 
  CHECK (calculation_method IN ('per_sqm', 'fixed_monthly', 'hourly', 'custom'));

-- Verwijder "Flexplek" uit het space_type check constraint op office_spaces
ALTER TABLE office_spaces 
  DROP CONSTRAINT IF EXISTS office_spaces_space_type_check;

ALTER TABLE office_spaces
  ADD CONSTRAINT office_spaces_space_type_check 
  CHECK (space_type IN ('bedrijfsruimte', 'kantoor', 'buitenterrein', 'diversen', 'Meeting Room'));

-- Voeg commentaar toe voor duidelijkheid
COMMENT ON COLUMN office_spaces.is_flex_space IS 'Geeft aan of deze ruimte beschikbaar is voor flex workspace gebruik';
COMMENT ON COLUMN leases.lease_type IS 'Type huurcontract: full_time (vaste ruimte) of flex (flexplek zonder vaste ruimte)';
COMMENT ON COLUMN leases.flex_pricing_model IS 'Pricing model voor flex contracten: daily, monthly_unlimited, of credit_based';
