/*
  # Add diversen calculation fields to office_spaces

  1. Changes
    - Add `diversen_calculation` column to office_spaces (to store calculation method)
    - Add `diversen_quantity` column to office_spaces (for quantity x price calculation)
    - Add `diversen_unit_price` column to office_spaces (for quantity x price calculation)

  2. Explanation
    For "diversen" (miscellaneous) space types, we need to support multiple calculation methods:
    - 'fixed': Fixed monthly amount (stored in square_footage field for backwards compatibility)
    - 'per_sqm': Per square meter (uses square_footage and rate_per_sqm)
    - 'quantity_price': Quantity times unit price (uses diversen_quantity and diversen_unit_price)

    This allows flexible pricing for miscellaneous items that don't fit standard space types.
*/

-- Add diversen calculation columns to office_spaces table
DO $$
BEGIN
  -- Add diversen_calculation column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'diversen_calculation'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN diversen_calculation text;
  END IF;

  -- Add diversen_quantity column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'diversen_quantity'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN diversen_quantity decimal(10,2);
  END IF;

  -- Add diversen_unit_price column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'diversen_unit_price'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN diversen_unit_price decimal(10,2);
  END IF;
END $$;
