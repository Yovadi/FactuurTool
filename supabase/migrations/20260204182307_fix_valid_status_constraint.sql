/*
  # Fix Valid Status Constraint

  1. Changes
    - Drop the old 'valid_status' constraint
    - Add 'credited' and 'cancelled' to the valid_status constraint
    
  2. Security
    - No changes to RLS policies needed
*/

-- Drop the old constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS valid_status;

-- Add the new constraint with credited and cancelled
ALTER TABLE invoices ADD CONSTRAINT valid_status
  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'credited'));