/*
  # Add half day and full day rate fields to office_spaces

  1. Changes
    - Add `half_day_rate` column to office_spaces for half day booking pricing
    - Add `full_day_rate` column to office_spaces for full day booking pricing
    - These fields are used for automatic rate selection based on booking duration

  2. Usage
    - Bookings < 4 hours: use hourly_rate × hours
    - Bookings 4-6 hours: use half_day_rate
    - Bookings > 6 hours: use full_day_rate
*/

-- Add half_day_rate and full_day_rate columns to office_spaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'half_day_rate'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN half_day_rate numeric(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'full_day_rate'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN full_day_rate numeric(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add comments for clarity
COMMENT ON COLUMN office_spaces.half_day_rate IS 'Tarief voor halve dag boeking (4-6 uur)';
COMMENT ON COLUMN office_spaces.full_day_rate IS 'Tarief voor hele dag boeking (>6 uur)';