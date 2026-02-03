/*
  # Manually sync flex rates to existing office_spaces

  1. Purpose
    - Ensure all Flexplek office_spaces have the correct rates from space_type_rates
    - Handles both furnished and unfurnished spaces
    - Updates hourly_rate, half_day_rate, and full_day_rate fields

  2. Changes
    - Updates all Flexplek spaces with rates from space_type_rates table
    - Uses furnished-specific rates if space is furnished
    - Falls back to standard rates if furnished rates are not set
*/

-- Update all Flexplek spaces with rates from space_type_rates
UPDATE office_spaces os
SET
  hourly_rate = str.hourly_rate,
  half_day_rate = CASE
    WHEN os.is_furnished = true AND str.half_day_rate_furnished > 0 
    THEN str.half_day_rate_furnished
    ELSE str.half_day_rate
  END,
  full_day_rate = CASE
    WHEN os.is_furnished = true AND str.full_day_rate_furnished > 0 
    THEN str.full_day_rate_furnished
    ELSE str.full_day_rate
  END,
  daily_rate = CASE
    WHEN os.is_furnished = true AND str.daily_rate_furnished > 0 
    THEN str.daily_rate_furnished
    ELSE str.daily_rate
  END
FROM space_type_rates str
WHERE os.space_type = 'Flexplek'
  AND str.space_type = 'Flexplek';
