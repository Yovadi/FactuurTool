/*
  # Synchronize rate changes to lease_spaces

  1. Changes
    - Updates `sync_rates_to_office_spaces()` function to also update lease_spaces
    - When space_type_rates are changed, lease_spaces monthly_rent is recalculated
    
  2. Logic
    - Only updates lease_spaces where price_per_sqm matches the old rate (respects custom prices)
    - Recalculates monthly_rent based on space square_footage and new rate
    - Handles annual rates (bedrijfsruimte, buitenterrein) by dividing by 12
    - Handles furnished rates for kantoor spaces
    
  3. Important Notes
    - Only active leases are updated
    - Custom/manual prices are not overwritten
*/

-- Create or replace the sync function to also update lease_spaces
CREATE OR REPLACE FUNCTION sync_rates_to_office_spaces()
RETURNS TRIGGER AS $$
BEGIN
  -- Update matching office spaces based on space type
  IF NEW.space_type = 'Meeting Room' AND NEW.calculation_method = 'hourly' THEN
    UPDATE office_spaces
    SET hourly_rate = NEW.hourly_rate
    WHERE space_type = 'Meeting Room'
      AND (hourly_rate IS NULL OR hourly_rate = OLD.hourly_rate);
      
  ELSIF NEW.space_type = 'Flexplek' AND NEW.calculation_method = 'daily' THEN
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

    -- Also update lease_spaces for kantoor (annual rate, divide by 12)
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
      AND l.status = 'active'
      AND (
        ls.price_per_sqm = OLD.rate_per_sqm 
        OR (os.is_furnished = true AND ls.price_per_sqm = OLD.rate_per_sqm_furnished)
      );
      
  ELSIF (NEW.space_type = 'bedrijfsruimte' OR NEW.space_type = 'buitenterrein') 
    AND (NEW.calculation_method = 'per_sqm' OR NEW.calculation_method = 'custom') THEN
    UPDATE office_spaces
    SET rate_per_sqm = NEW.rate_per_sqm
    WHERE space_type = NEW.space_type
      AND (rate_per_sqm IS NULL OR rate_per_sqm = OLD.rate_per_sqm);

    -- Also update lease_spaces for bedrijfsruimte/buitenterrein (annual rate, divide by 12)
    UPDATE lease_spaces ls
    SET 
      price_per_sqm = NEW.rate_per_sqm,
      monthly_rent = ROUND((os.square_footage * NEW.rate_per_sqm / 12)::numeric, 2)
    FROM office_spaces os
    INNER JOIN leases l ON l.id = ls.lease_id
    WHERE ls.space_id = os.id
      AND os.space_type = NEW.space_type
      AND l.status = 'active'
      AND ls.price_per_sqm = OLD.rate_per_sqm;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
