/*
  # Make lease_id nullable in invoices table

  1. Changes
    - Modify `invoices` table to make `lease_id` nullable
    - This allows creating standalone invoices without a lease contract
    - Existing invoices with lease_id remain unchanged
  
  2. Notes
    - This is a non-destructive change
    - Existing foreign key constraint is maintained
    - Invoices can now be created independently or linked to a lease
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'lease_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE invoices ALTER COLUMN lease_id DROP NOT NULL;
  END IF;
END $$;