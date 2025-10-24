/*
  # Remove space_id from leases table

  ## Overview
  Removes the old space_id column from leases table now that we use lease_spaces junction table.

  ## Changes
  - Drop space_id column from leases table (if it exists)
  - Drop monthly_rent column from leases table (if it exists)
  
  ## Important Notes
  The space_id is now stored in the lease_spaces junction table to support multiple spaces per lease.
*/

-- Remove space_id from leases (now in lease_spaces)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'space_id'
  ) THEN
    ALTER TABLE leases DROP COLUMN space_id;
  END IF;
END $$;

-- Remove monthly_rent from leases (now calculated from lease_spaces)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'monthly_rent'
  ) THEN
    ALTER TABLE leases DROP COLUMN monthly_rent;
  END IF;
END $$;
