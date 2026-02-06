/*
  # Sync Flex Space Day Rates

  1. Problem
    - Flex spaces also have half_day_rate and full_day_rate but these are not synced
    - The sync trigger only syncs daily_rate for flex spaces

  2. Solution
    - Update the sync function to also sync half_day_rate and full_day_rate for flex spaces
    - Include both furnished and unfurnished variants
    - Manually sync existing rates

  3. Changes
    - Modified sync_rates_to_office_spaces() to sync all flex rate variants
    - Execute one-time update to sync current rates to all flex spaces
*/

-- Update the sync function to include flex day rates
CREATE OR REPLACE FUNCTION sync_rates_to_office_spaces()
RETURNS TRIGGER AS $$
BEGIN
  -- Update matching office spaces based on space type
  IF NEW.space_type = 'Meeting Room' AND NEW.calculation_method = 'hourly' THEN
    -- Update meeting rooms with all rate types
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
    -- Update flex spaces with all rate variants (daily, half_day, full_day)
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
      hourly_rate = NEW.hourly_rate
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
      
  ELSIF (NEW.space_type = 'bedrijfsruimte' OR NEW.space_type = 'buitenterrein') 
    AND (NEW.calculation_method = 'per_sqm' OR NEW.calculation_method = 'custom') THEN
    -- Update bedrijfsruimte and buitenterrein with per sqm rate
    UPDATE office_spaces
    SET rate_per_sqm = NEW.rate_per_sqm
    WHERE space_type = NEW.space_type
      AND (rate_per_sqm IS NULL OR rate_per_sqm = OLD.rate_per_sqm);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- One-time update: Sync current rates from space_type_rates to all flex spaces
UPDATE office_spaces os
SET 
  daily_rate = CASE
    WHEN os.is_furnished = true AND str.daily_rate_furnished > 0 THEN str.daily_rate_furnished
    ELSE str.daily_rate
  END,
  half_day_rate = CASE
    WHEN os.is_furnished = true AND str.half_day_rate_furnished > 0 THEN str.half_day_rate_furnished
    ELSE str.half_day_rate
  END,
  full_day_rate = CASE
    WHEN os.is_furnished = true AND str.full_day_rate_furnished > 0 THEN str.full_day_rate_furnished
    ELSE str.full_day_rate
  END,
  hourly_rate = str.hourly_rate
FROM space_type_rates str
WHERE os.space_type = 'Flexplek'
  AND str.space_type = 'Flexplek'
  AND str.calculation_method = 'daily';