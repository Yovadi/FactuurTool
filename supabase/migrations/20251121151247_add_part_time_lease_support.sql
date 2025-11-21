/*
  # Add Part-Time Lease Support

  1. Changes to `leases` table
    - Add `lease_type` (text) - Type of lease: 'full_time' or 'part_time'
    - Add `daily_rate` (numeric) - Price per day for part-time leases
    - Add `days_per_week` (integer) - Number of days per week for part-time leases
    - Add `selected_days` (text array) - Which days are selected (ma, di, wo, do, vr)

  2. Calculation Logic
    - Full-time leases: Use existing monthly_rent field
    - Part-time leases: daily_rate × days_per_week × 4.33 (average weeks per month)

  3. Important Notes
    - Existing leases will default to 'full_time' type
    - For part-time leases, monthly_rent will be calculated automatically
    - The 4.33 multiplier ensures consistent monthly invoicing (52 weeks ÷ 12 months)
*/

-- Add new columns to leases table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'lease_type'
  ) THEN
    ALTER TABLE leases ADD COLUMN lease_type text NOT NULL DEFAULT 'full_time';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'daily_rate'
  ) THEN
    ALTER TABLE leases ADD COLUMN daily_rate numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'days_per_week'
  ) THEN
    ALTER TABLE leases ADD COLUMN days_per_week integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'selected_days'
  ) THEN
    ALTER TABLE leases ADD COLUMN selected_days text[];
  END IF;
END $$;

-- Add constraint for valid lease type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_lease_type'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT valid_lease_type 
      CHECK (lease_type IN ('full_time', 'part_time'));
  END IF;
END $$;

-- Add constraint for part-time lease requirements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'part_time_lease_requirements'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT part_time_lease_requirements
      CHECK (
        (lease_type = 'full_time') OR
        (lease_type = 'part_time' AND daily_rate IS NOT NULL AND daily_rate > 0 AND days_per_week IS NOT NULL AND days_per_week BETWEEN 1 AND 5)
      );
  END IF;
END $$;

-- Create or replace function to calculate monthly rent for part-time leases
CREATE OR REPLACE FUNCTION calculate_part_time_monthly_rent(
  p_daily_rate numeric,
  p_days_per_week integer
)
RETURNS numeric AS $$
BEGIN
  -- Calculate: daily_rate × days_per_week × 4.33 (average weeks per month)
  RETURN ROUND(p_daily_rate * p_days_per_week * 4.33, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function to auto-calculate monthly_rent for part-time leases
CREATE OR REPLACE FUNCTION update_part_time_monthly_rent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lease_type = 'part_time' AND NEW.daily_rate IS NOT NULL AND NEW.days_per_week IS NOT NULL THEN
    NEW.monthly_rent := calculate_part_time_monthly_rent(NEW.daily_rate, NEW.days_per_week);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_part_time_monthly_rent'
  ) THEN
    CREATE TRIGGER trigger_update_part_time_monthly_rent
      BEFORE INSERT OR UPDATE OF daily_rate, days_per_week, lease_type
      ON leases
      FOR EACH ROW
      EXECUTE FUNCTION update_part_time_monthly_rent();
  END IF;
END $$;