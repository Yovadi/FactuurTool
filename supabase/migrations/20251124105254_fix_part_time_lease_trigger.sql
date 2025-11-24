/*
  # Fix Part-Time Lease Trigger

  1. Changes
    - Remove the trigger that tries to update monthly_rent field (which no longer exists)
    - Remove the monthly_rent calculation function
    - Part-time leases will calculate monthly rent on-the-fly in application code

  2. Important Notes
    - The monthly_rent field was removed in a previous migration
    - Monthly rent is now calculated from lease_spaces table
    - For part-time leases, we calculate: daily_rate × days_per_week × 4.33
*/

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_part_time_monthly_rent ON leases;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_part_time_monthly_rent();

-- Drop the calculation function (we'll calculate in app code instead)
DROP FUNCTION IF EXISTS calculate_part_time_monthly_rent(numeric, integer);