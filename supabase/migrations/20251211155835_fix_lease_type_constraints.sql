/*
  # Fix Lease Type Constraints
  
  1. Problem
    - There are two conflicting lease_type constraints:
      - `valid_lease_type` only allows 'full_time' and 'part_time'
      - `leases_lease_type_check` only allows 'full_time' and 'flex' (missing 'part_time')
    - Both constraints exist simultaneously, causing issues
  
  2. Solution
    - Remove the old `valid_lease_type` constraint
    - Update `leases_lease_type_check` to allow all three types: 'full_time', 'part_time', and 'flex'
  
  3. Result
    - Single, correct constraint that allows all valid lease types
*/

-- Drop both old constraints
ALTER TABLE leases DROP CONSTRAINT IF EXISTS valid_lease_type;
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_lease_type_check;

-- Add single correct constraint with all valid lease types
ALTER TABLE leases ADD CONSTRAINT leases_lease_type_check
  CHECK (lease_type IN ('full_time', 'part_time', 'flex'));