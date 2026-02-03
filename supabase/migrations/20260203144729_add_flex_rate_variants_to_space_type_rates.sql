/*
  # Add flex booking rate variants to space_type_rates

  1. Changes
    - Add `half_day_rate` column for half-day booking pricing
    - Add `full_day_rate` column for full-day booking pricing
    - Add `half_day_rate_furnished` column for furnished half-day bookings
    - Add `full_day_rate_furnished` column for furnished full-day bookings
    - Update existing sync triggers to handle the new rate fields

  2. Purpose
    - Allow different pricing for hourly, half-day, and full-day bookings
    - Support furnished vs unfurnished pricing for all booking types
    - Automatically sync these rates to office_spaces based on is_furnished flag

  3. Usage
    - Set rates in space_type_rates table
    - Rates automatically sync to office_spaces via trigger
    - Booking logic uses appropriate rate based on duration and furnished status
*/

-- Add half_day and full_day rate columns
ALTER TABLE space_type_rates
ADD COLUMN IF NOT EXISTS half_day_rate numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS full_day_rate numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS half_day_rate_furnished numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS full_day_rate_furnished numeric(10, 2) DEFAULT 0;

-- Add comments
COMMENT ON COLUMN space_type_rates.half_day_rate IS 'Tarief voor halve dag boeking (4-8 uur) - ongemeubileerd';
COMMENT ON COLUMN space_type_rates.full_day_rate IS 'Tarief voor hele dag boeking (8+ uur) - ongemeubileerd';
COMMENT ON COLUMN space_type_rates.half_day_rate_furnished IS 'Tarief voor halve dag boeking (4-8 uur) - gemeubileerd';
COMMENT ON COLUMN space_type_rates.full_day_rate_furnished IS 'Tarief voor hele dag boeking (8+ uur) - gemeubileerd';

-- Set default rates for Flexplek space type
UPDATE space_type_rates
SET
  half_day_rate = 15.00,
  full_day_rate = 25.00,
  half_day_rate_furnished = 20.00,
  full_day_rate_furnished = 35.00
WHERE space_type = 'Flexplek';

-- Update the sync trigger function to handle new rate fields
CREATE OR REPLACE FUNCTION sync_space_type_rates_to_spaces_v2()
RETURNS TRIGGER AS $$
BEGIN
  -- For Flexplek spaces, sync daily rates and hourly/half-day/full-day variants
  IF NEW.space_type = 'Flexplek' THEN
    UPDATE office_spaces
    SET
      daily_rate = CASE
        WHEN is_furnished = true AND NEW.daily_rate_furnished > 0 THEN NEW.daily_rate_furnished
        ELSE NEW.daily_rate
      END,
      hourly_rate = NEW.hourly_rate,
      half_day_rate = CASE
        WHEN is_furnished = true AND NEW.half_day_rate_furnished > 0 THEN NEW.half_day_rate_furnished
        ELSE NEW.half_day_rate
      END,
      full_day_rate = CASE
        WHEN is_furnished = true AND NEW.full_day_rate_furnished > 0 THEN NEW.full_day_rate_furnished
        ELSE NEW.full_day_rate
      END
    WHERE space_type = 'Flexplek'
      AND (
        daily_rate IS NULL
        OR daily_rate = OLD.daily_rate
        OR (is_furnished = true AND daily_rate = OLD.daily_rate_furnished)
        OR hourly_rate IS NULL
        OR hourly_rate = OLD.hourly_rate
        OR half_day_rate IS NULL
        OR half_day_rate = OLD.half_day_rate
        OR (is_furnished = true AND half_day_rate = OLD.half_day_rate_furnished)
        OR full_day_rate IS NULL
        OR full_day_rate = OLD.full_day_rate
        OR (is_furnished = true AND full_day_rate = OLD.full_day_rate_furnished)
      );

  ELSIF NEW.space_type = 'kantoor' AND (NEW.calculation_method = 'per_sqm' OR NEW.calculation_method = 'custom') THEN
    -- Update offices with per sqm rate (furnished and unfurnished)
    UPDATE office_spaces
    SET rate_per_sqm = CASE
      WHEN is_furnished = true AND NEW.rate_per_sqm_furnished > 0 THEN NEW.rate_per_sqm_furnished
      ELSE NEW.rate_per_sqm
    END
    WHERE space_type = 'kantoor'
      AND (
        rate_per_sqm IS NULL
        OR rate_per_sqm = OLD.rate_per_sqm
        OR (is_furnished = true AND rate_per_sqm = OLD.rate_per_sqm_furnished)
      );

    -- Also update lease_spaces for kantoor
    UPDATE lease_spaces ls
    SET
      price_per_sqm = CASE
        WHEN os.is_furnished = true AND NEW.rate_per_sqm_furnished > 0 THEN NEW.rate_per_sqm_furnished
        ELSE NEW.rate_per_sqm
      END,
      monthly_rent = ROUND((os.square_footage * CASE
        WHEN os.is_furnished = true AND NEW.rate_per_sqm_furnished > 0 THEN NEW.rate_per_sqm_furnished
        ELSE NEW.rate_per_sqm
      END / 12)::numeric, 2)
    FROM office_spaces os
    INNER JOIN leases l ON l.id = ls.lease_id
    WHERE ls.space_id = os.id
      AND os.space_type = 'kantoor'
      AND l.lease_type = 'fixed'
      AND (
        ls.price_per_sqm IS NULL
        OR ls.price_per_sqm = OLD.rate_per_sqm
        OR (os.is_furnished = true AND ls.price_per_sqm = OLD.rate_per_sqm_furnished)
      );

  ELSIF (NEW.space_type = 'bedrijfsruimte' OR NEW.space_type = 'buitenterrein')
    AND (NEW.calculation_method = 'per_sqm' OR NEW.calculation_method = 'custom') THEN
    -- Update bedrijfsruimte and buitenterrein with per sqm rate
    UPDATE office_spaces
    SET rate_per_sqm = NEW.rate_per_sqm
    WHERE space_type = NEW.space_type
      AND (rate_per_sqm IS NULL OR rate_per_sqm = OLD.rate_per_sqm);

    -- Also update lease_spaces
    UPDATE lease_spaces ls
    SET
      price_per_sqm = NEW.rate_per_sqm,
      monthly_rent = ROUND((os.square_footage * NEW.rate_per_sqm / 12)::numeric, 2)
    FROM office_spaces os
    INNER JOIN leases l ON l.id = ls.lease_id
    WHERE ls.space_id = os.id
      AND os.space_type = NEW.space_type
      AND l.lease_type = 'fixed'
      AND (ls.price_per_sqm IS NULL OR ls.price_per_sqm = OLD.rate_per_sqm);
  END IF;

  -- Sync diversen calculations
  IF NEW.diversen_per_sqm IS NOT NULL OR OLD.diversen_per_sqm IS NOT NULL THEN
    UPDATE lease_spaces ls
    SET diversen_amount = ROUND((os.square_footage * NEW.diversen_per_sqm / 12)::numeric, 2)
    FROM office_spaces os
    INNER JOIN leases l ON l.id = ls.lease_id
    WHERE ls.space_id = os.id
      AND os.space_type = NEW.space_type
      AND l.lease_type = 'fixed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the old trigger if it exists
DROP TRIGGER IF EXISTS space_type_rates_sync_trigger ON space_type_rates;
DROP TRIGGER IF EXISTS space_type_rates_sync_trigger_v2 ON space_type_rates;

-- Create the updated trigger
CREATE TRIGGER space_type_rates_sync_trigger_v2
  AFTER INSERT OR UPDATE ON space_type_rates
  FOR EACH ROW
  EXECUTE FUNCTION sync_space_type_rates_to_spaces_v2();