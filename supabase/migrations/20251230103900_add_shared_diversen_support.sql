/*
  # Add shared space support for diversen

  1. Changes
    - Add `is_shared` column to office_spaces (to mark spaces that can be rented by multiple tenants)
    - Add `shared_capacity` column to office_spaces (maximum number of tenants that can rent this space)

  2. Explanation
    For "diversen" (miscellaneous) space types, we want to allow multiple tenants to rent the same 
    space simultaneously. For example, a shared parking space or shared storage unit could be 
    rented by multiple tenants.

    The `is_shared` flag indicates if a space can be rented by multiple tenants.
    The `shared_capacity` defines the maximum number of tenants that can rent this space.

    This is different from flex_capacity which is for simultaneous use - shared_capacity
    is for simultaneous rental agreements.
*/

-- Add shared space columns to office_spaces table
DO $$
BEGIN
  -- Add is_shared column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'is_shared'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN is_shared boolean DEFAULT false;
  END IF;

  -- Add shared_capacity column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spaces' AND column_name = 'shared_capacity'
  ) THEN
    ALTER TABLE office_spaces ADD COLUMN shared_capacity integer DEFAULT 1;
  END IF;
END $$;
