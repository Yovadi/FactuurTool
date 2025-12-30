/*
  # Add automatic rate synchronization

  1. New Functions
    - `sync_rates_to_office_spaces()` - Updates office_spaces rates when space_type_rates change

  2. New Triggers
    - Trigger on space_type_rates UPDATE to automatically sync rates to matching office_spaces

  3. Explanation
    When a rate is updated in space_type_rates, all office_spaces with matching space_type
    will have their rates updated automatically. This ensures consistency between the rate 
    configuration and actual spaces.

    The function respects:
    - Space type matching
    - Furnished vs unfurnished rates for kantoor
    - Different rate types (per_sqm, hourly, daily) based on space type
    - Only updates spaces that don't have manually overridden rates
*/

-- Create function to sync rates from space_type_rates to office_spaces
CREATE OR REPLACE FUNCTION sync_rates_to_office_spaces()
RETURNS TRIGGER AS $$
BEGIN
  -- Update matching office spaces based on space type
  IF NEW.space_type = 'Meeting Room' AND NEW.calculation_method = 'hourly' THEN
    -- Update meeting rooms with hourly rate
    UPDATE office_spaces
    SET hourly_rate = NEW.hourly_rate
    WHERE space_type = 'Meeting Room'
      AND (hourly_rate IS NULL OR hourly_rate = OLD.hourly_rate);
      
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

-- Create trigger to automatically sync rates after update
DROP TRIGGER IF EXISTS trigger_sync_rates_to_office_spaces ON space_type_rates;
CREATE TRIGGER trigger_sync_rates_to_office_spaces
  AFTER UPDATE ON space_type_rates
  FOR EACH ROW
  EXECUTE FUNCTION sync_rates_to_office_spaces();
