/*
  # Fix Flex Lease Constraint
  
  1. Changes
    - Update `part_time_lease_requirements` constraint to allow 'flex' lease type
    - The constraint previously only allowed 'full_time' and 'part_time'
    - Now it will also allow 'flex' without requiring daily_rate and days_per_week
  
  2. Important Notes
    - Flex leases use different fields (flex_pricing_model, flex_daily_rate, etc.)
    - The old constraint was preventing flex leases from being created
*/

-- Drop the old part_time_lease_requirements constraint
ALTER TABLE leases DROP CONSTRAINT IF EXISTS part_time_lease_requirements;

-- Add updated constraint that allows flex leases
ALTER TABLE leases ADD CONSTRAINT part_time_lease_requirements
  CHECK (
    (lease_type = 'full_time') OR
    (lease_type = 'part_time' AND daily_rate IS NOT NULL AND daily_rate > 0 AND days_per_week IS NOT NULL AND days_per_week BETWEEN 1 AND 5) OR
    (lease_type = 'flex')
  );