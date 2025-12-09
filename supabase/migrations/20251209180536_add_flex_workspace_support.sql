/*
  # Flexplekken Ondersteuning

  1. Wijzigingen aan Bestaande Structuur
    - Voeg 'Flexplek' toe aan space_type in office_spaces
    - Voeg 'flex' toe aan lease_type in leases
    - Voeg flex-specifieke velden toe aan leases tabel

  2. Nieuwe Velden in Leases voor Flex Tariefmodellen
    - `flex_pricing_model` - Type tariefmodel (daily, monthly_unlimited, credit_based)
    - `flex_daily_rate` - Dagprijs voor dagelijks model
    - `flex_monthly_rate` - Vast maandbedrag voor onbeperkt model
    - `flex_credits_per_month` - Aantal dagen/credits per maand
    - `flex_credit_rate` - Prijs per credit/dag voor credit-based model

  3. Space Type Rates
    - Voeg standaard flexplek tarief toe

  4. Beveiliging
    - Bestaande RLS policies blijven van toepassing
*/

-- Voeg 'Flexplek' toe aan space_type check constraint in office_spaces
DO $$
BEGIN
  -- Drop de oude constraint
  ALTER TABLE office_spaces DROP CONSTRAINT IF EXISTS office_spaces_space_type_check;
  
  -- Voeg nieuwe constraint toe met 'Flexplek'
  ALTER TABLE office_spaces ADD CONSTRAINT office_spaces_space_type_check
    CHECK (space_type IN ('bedrijfsruimte', 'kantoor', 'buitenterrein', 'diversen', 'voorschot', 'Meeting Room', 'Flexplek'));
END $$;

-- Voeg 'flex' toe aan lease_type check constraint in leases
DO $$
BEGIN
  -- Drop de oude constraint
  ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_lease_type_check;
  
  -- Voeg nieuwe constraint toe met 'flex'
  ALTER TABLE leases ADD CONSTRAINT leases_lease_type_check
    CHECK (lease_type IN ('full_time', 'part_time', 'flex'));
END $$;

-- Voeg flex-specifieke velden toe aan leases tabel
DO $$
BEGIN
  -- flex_pricing_model: daily (dagprijs), monthly_unlimited (vast maandbedrag onbeperkt), credit_based (strippenkaart)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'flex_pricing_model'
  ) THEN
    ALTER TABLE leases ADD COLUMN flex_pricing_model text 
      CHECK (flex_pricing_model IN ('daily', 'monthly_unlimited', 'credit_based'));
  END IF;

  -- Dagprijs voor 'daily' model
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'flex_daily_rate'
  ) THEN
    ALTER TABLE leases ADD COLUMN flex_daily_rate numeric(10, 2) DEFAULT 0;
  END IF;

  -- Vast maandbedrag voor 'monthly_unlimited' model
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'flex_monthly_rate'
  ) THEN
    ALTER TABLE leases ADD COLUMN flex_monthly_rate numeric(10, 2) DEFAULT 0;
  END IF;

  -- Aantal credits/dagen per maand voor 'credit_based' model
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'flex_credits_per_month'
  ) THEN
    ALTER TABLE leases ADD COLUMN flex_credits_per_month integer DEFAULT 0;
  END IF;

  -- Prijs per credit voor 'credit_based' model
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leases' AND column_name = 'flex_credit_rate'
  ) THEN
    ALTER TABLE leases ADD COLUMN flex_credit_rate numeric(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Voeg standaard Flexplek tarief toe aan space_type_rates
INSERT INTO space_type_rates (space_type, calculation_method, fixed_rate, description)
VALUES ('Flexplek', 'custom', 0, 'Flexplek - Flexibel werkplek met verschillende tariefmodellen')
ON CONFLICT (space_type) DO NOTHING;

-- Voeg commentaar toe aan nieuwe kolommen
COMMENT ON COLUMN leases.flex_pricing_model IS 'Tariefmodel voor flexplekken: daily (dagprijs), monthly_unlimited (onbeperkt maandbedrag), credit_based (strippenkaart)';
COMMENT ON COLUMN leases.flex_daily_rate IS 'Dagprijs voor flexplekken bij daily pricing model';
COMMENT ON COLUMN leases.flex_monthly_rate IS 'Vast maandbedrag voor onbeperkt gebruik bij monthly_unlimited model';
COMMENT ON COLUMN leases.flex_credits_per_month IS 'Aantal dagen/credits per maand bij credit_based model';
COMMENT ON COLUMN leases.flex_credit_rate IS 'Prijs per credit/dag bij credit_based model';
