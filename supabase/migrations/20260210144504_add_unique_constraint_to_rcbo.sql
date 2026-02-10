/*
  # Add unique constraint to RCBO circuit breakers

  ## Changes
  - Adds unique constraint on (ala_group, rcbo_number) to prevent duplicate RCBO assignments
  - Cleans up any existing duplicates before applying constraint (keeps most recent record)
  
  ## Rationale
  Each RCBO automaat should have exactly one assignment. The unique constraint ensures
  that it's impossible to accidentally create multiple assignments for the same automaat.
*/

-- First, remove any duplicate entries (keep the most recent one)
DELETE FROM rcbo_circuit_breakers a
WHERE a.id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY ala_group, rcbo_number 
        ORDER BY updated_at DESC, created_at DESC
      ) as rn
    FROM rcbo_circuit_breakers
  ) t
  WHERE t.rn > 1
);

-- Add unique constraint to prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rcbo_circuit_breakers_ala_group_rcbo_number_key'
  ) THEN
    ALTER TABLE rcbo_circuit_breakers
      ADD CONSTRAINT rcbo_circuit_breakers_ala_group_rcbo_number_key 
      UNIQUE (ala_group, rcbo_number);
  END IF;
END $$;