/*
  # Add furnished hourly rate to space type rates

  1. Changes
    - Add `hourly_rate_furnished` column to `space_type_rates` table
      - Allows setting a separate hourly rate for furnished flex desks
    - Update `sync_rates_to_office_spaces()` trigger function
      - When a flex space is furnished, use `hourly_rate_furnished` for office_spaces.hourly_rate
    - One-time sync of existing rates to furnished flex spaces

  2. Important Notes
    - Non-destructive: only adds a new column and updates the trigger
    - Existing hourly_rate behavior unchanged for non-furnished spaces
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'space_type_rates' AND column_name = 'hourly_rate_furnished'
  ) THEN
    ALTER TABLE space_type_rates ADD COLUMN hourly_rate_furnished numeric DEFAULT 0;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_rates_to_office_spaces()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.space_type = 'Meeting Room' AND NEW.calculation_method = 'hourly' THEN
    UPDATE office_spaces
    SET 
      hourly_rate = NEW.hourly_rate,
      half_day_rate = NEW.half_day_rate,
      full_day_rate = NEW.full_day_rate
    WHERE space_type = 'Meeting Room'
      AND (
        hourly_rate IS NULL OR hourly_rate = OLD.hourly_rate
        OR half_day_rate IS NULL OR half_day_rate = OLD.half_day_rate
        OR full_day_rate IS NULL OR full_day_rate = OLD.full_day_rate
      );
      
  ELSIF NEW.space_type = 'Flexplek' AND NEW.calculation_method = 'daily' THEN
    UPDATE office_spaces
    SET 
      daily_rate = CASE
        WHEN is_furnished = true AND NEW.daily_rate_furnished > 0 THEN NEW.daily_rate_furnished
        ELSE NEW.daily_rate
      END,
      half_day_rate = CASE
        WHEN is_furnished = true AND NEW.half_day_rate_furnished > 0 THEN NEW.half_day_rate_furnished
        ELSE NEW.half_day_rate
      END,
      full_day_rate = CASE
        WHEN is_furnished = true AND NEW.full_day_rate_furnished > 0 THEN NEW.full_day_rate_furnished
        ELSE NEW.full_day_rate
      END,
      hourly_rate = CASE
        WHEN is_furnished = true AND NEW.hourly_rate_furnished > 0 THEN NEW.hourly_rate_furnished
        ELSE NEW.hourly_rate
      END
    WHERE space_type = 'Flexplek'
      AND (
        daily_rate IS NULL 
        OR daily_rate = OLD.daily_rate 
        OR (is_furnished = true AND daily_rate = OLD.daily_rate_furnished)
        OR half_day_rate IS NULL
        OR half_day_rate = OLD.half_day_rate
        OR (is_furnished = true AND half_day_rate = OLD.half_day_rate_furnished)
        OR full_day_rate IS NULL
        OR full_day_rate = OLD.full_day_rate
        OR (is_furnished = true AND full_day_rate = OLD.full_day_rate_furnished)
        OR hourly_rate IS NULL
        OR hourly_rate = OLD.hourly_rate
        OR (is_furnished = true AND hourly_rate = OLD.hourly_rate_furnished)
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
      
  ELSIF (NEW.space_type = 'bedrijfsruimte' OR NEW.space_type = 'buitenterrein') 
    AND (NEW.calculation_method = 'per_sqm' OR NEW.calculation_method = 'custom') THEN
    UPDATE office_spaces
    SET rate_per_sqm = NEW.rate_per_sqm
    WHERE space_type = NEW.space_type
      AND (rate_per_sqm IS NULL OR rate_per_sqm = OLD.rate_per_sqm);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE office_spaces os
SET 
  hourly_rate = CASE
    WHEN os.is_furnished = true AND str.hourly_rate_furnished > 0 THEN str.hourly_rate_furnished
    ELSE str.hourly_rate
  END
FROM space_type_rates str
WHERE os.space_type = 'Flexplek'
  AND str.space_type = 'Flexplek'
  AND str.calculation_method = 'daily';