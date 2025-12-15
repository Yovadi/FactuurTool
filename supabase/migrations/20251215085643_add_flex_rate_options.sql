/*
  # Flexplek Tariefopties

  1. Wijzigingen aan space_type_rates
    - Voeg `daily_rate` (numeric) toe - Prijs per dag voor flexplek
    - Voeg `punch_card_rate` (numeric) toe - Prijs voor strippenkaart
    - Voeg `punch_card_days` (integer) toe - Aantal dagen in strippenkaart
    - Update calculation_method constraint om 'daily' en 'punch_card' toe te voegen

  2. Notities
    - Voor Flexplek zijn er nu 3 opties beschikbaar:
      1. Per dag (x dagen per maand) - daily rate × aantal dagen
      2. Vast maandbedrag - fixed_monthly (bestaand)
      3. Strippenkaart x dagen per maand - punch_card rate voor x dagen
*/

-- Voeg nieuwe kolommen toe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'daily_rate'
  ) THEN
    ALTER TABLE space_type_rates ADD COLUMN daily_rate numeric(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'punch_card_rate'
  ) THEN
    ALTER TABLE space_type_rates ADD COLUMN punch_card_rate numeric(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'punch_card_days'
  ) THEN
    ALTER TABLE space_type_rates ADD COLUMN punch_card_days integer DEFAULT 0;
  END IF;
END $$;

-- Update de calculation_method constraint
ALTER TABLE space_type_rates 
  DROP CONSTRAINT IF EXISTS space_type_rates_calculation_method_check;

ALTER TABLE space_type_rates
  ADD CONSTRAINT space_type_rates_calculation_method_check 
  CHECK (calculation_method IN ('per_sqm', 'fixed_monthly', 'hourly', 'custom', 'daily', 'punch_card'));

-- Voeg commentaren toe voor duidelijkheid
COMMENT ON COLUMN space_type_rates.daily_rate IS 'Prijs per dag voor flexplek berekening';
COMMENT ON COLUMN space_type_rates.punch_card_rate IS 'Prijs voor strippenkaart (inclusief x dagen)';
COMMENT ON COLUMN space_type_rates.punch_card_days IS 'Aantal dagen in strippenkaart';