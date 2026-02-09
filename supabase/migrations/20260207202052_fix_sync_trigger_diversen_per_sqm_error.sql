/*
  # Fix sync trigger referencing non-existent diversen_per_sqm column

  1. Problem
    - `sync_space_type_rates_to_spaces_v2()` references `NEW.diversen_per_sqm` which does not exist
    - This causes an error when updating any space_type_rate record
  
  2. Solution
    - Recreate the function without the diversen_per_sqm reference
    - Also add hourly_rate_furnished support for Flexplek spaces

  3. Important Notes
    - Non-destructive: only fixes the trigger function
*/

CREATE OR REPLACE FUNCTION sync_space_type_rates_to_spaces_v2()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.space_type = 'Flexplek' THEN
    UPDATE office_spaces
    SET
      daily_rate = CASE
        WHEN is_furnished = true AND NEW.daily_rate_furnished > 0 THEN NEW.daily_rate_furnished
        ELSE NEW.daily_rate
      END,
      hourly_rate = CASE
        WHEN is_furnished = true AND NEW.hourly_rate_furnished > 0 THEN NEW.hourly_rate_furnished
        ELSE NEW.hourly_rate
      END,
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
        OR (is_furnished = true AND hourly_rate = COALESCE(OLD.hourly_rate_furnished, 0))
        OR half_day_rate IS NULL
        OR half_day_rate = OLD.half_day_rate
        OR (is_furnished = true AND half_day_rate = OLD.half_day_rate_furnished)
        OR full_day_rate IS NULL
        OR full_day_rate = OLD.full_day_rate
        OR (is_furnished = true AND full_day_rate = OLD.full_day_rate_furnished)
      );

  ELSIF NEW.space_type = 'kantoor' AND (NEW.calculation_method = 'per_sqm' OR NEW.calculation_method = 'custom') THEN
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
    UPDATE office_spaces
    SET rate_per_sqm = NEW.rate_per_sqm
    WHERE space_type = NEW.space_type
      AND (rate_per_sqm IS NULL OR rate_per_sqm = OLD.rate_per_sqm);

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;