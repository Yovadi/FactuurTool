/*
  # Add diversen support to rate sync trigger

  1. Changes
    - Updates sync_rates_to_office_spaces() to also handle diversen spaces
    - When diversen fixed_rate changes, updates matching office_spaces and lease_spaces
    
  2. Logic
    - For diversen with 'fixed' calculation: updates square_footage (which stores the fixed amount)
    - Recalculates monthly_rent in lease_spaces based on diversen_calculation type
*/

CREATE OR REPLACE FUNCTION sync_rates_to_office_spaces()
RETURNS TRIGGER AS $$
BEGIN
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

  ELSIF NEW.space_type = 'diversen' AND NEW.calculation_method = 'fixed_monthly' THEN
    UPDATE office_spaces
    SET square_footage = NEW.fixed_rate
    WHERE space_type = 'diversen'
      AND diversen_calculation = 'fixed'
      AND (square_footage IS NULL OR square_footage = OLD.fixed_rate);

    UPDATE lease_spaces ls
    SET 
      price_per_sqm = NEW.fixed_rate,
      monthly_rent = NEW.fixed_rate
    FROM office_spaces os
    INNER JOIN leases l ON l.id = ls.lease_id
    WHERE ls.space_id = os.id
      AND os.space_type = 'diversen'
      AND os.diversen_calculation = 'fixed'
      AND l.status = 'active'
      AND ls.monthly_rent = OLD.fixed_rate;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
