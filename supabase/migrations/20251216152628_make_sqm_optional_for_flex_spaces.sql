/*
  # Make m2 fields optional for flex spaces

  1. Changes
    - Make `square_footage` nullable in `office_spaces` table
    - Flex spaces don't need m2 pricing, only capacity
    - Update constraint to allow NULL square_footage for flex spaces
  
  2. Notes
    - For flex spaces: only `flex_capacity` is required
    - For regular spaces: `square_footage` should still have a value
    - This allows pure flex spaces without m2 calculations
*/

ALTER TABLE office_spaces ALTER COLUMN square_footage DROP NOT NULL;

COMMENT ON COLUMN office_spaces.square_footage IS 'Square footage in m2. Optional for flex spaces, required for regular spaces';