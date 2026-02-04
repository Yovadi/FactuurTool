/*
  # Fix Meeting Room Rate Synchronization

  1. Problem
    - The rate sync trigger only syncs hourly_rate for meeting rooms
    - half_day_rate and full_day_rate are not synced, causing them to be NULL in office_spaces
    - This causes bookings to use incorrect rates (calculated from hourly rate instead of using the configured day rates)

  2. Solution
    - Update the sync_rates_to_office_spaces function to also sync half_day_rate and full_day_rate
    - Manually sync existing rates from space_type_rates to office_spaces

  3. Changes
    - Modified sync_rates_to_office_spaces() function to include half_day_rate and full_day_rate
    - Execute one-time update to sync current rates to all meeting rooms
*/

-- Update the sync function to include half_day_rate and full_day_rate
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
    -- Update flex spaces with daily rate (furnished and unfurnished)
    UPDATE office_spaces
    SET daily_rate = CASE
      WHEN is_furnished = true AND NEW.daily_rate_furnished > 0 THEN NEW.daily_rate_furnished
      ELSE NEW.daily_rate
    END
    WHERE space_type = 'Flexplek'
      AND (
        daily_rate IS NULL 
        OR daily_rate = OLD.daily_rate 
        OR (is_furnished = true AND daily_rate = OLD.daily_rate_furnished)
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

-- One-time update: Sync current rates from space_type_rates to all meeting rooms
UPDATE office_spaces os
SET 
  hourly_rate = str.hourly_rate,
  half_day_rate = str.half_day_rate,
  full_day_rate = str.full_day_rate
FROM space_type_rates str
WHERE os.space_type = 'Meeting Room'
  AND str.space_type = 'Meeting Room'
  AND str.calculation_method = 'hourly';