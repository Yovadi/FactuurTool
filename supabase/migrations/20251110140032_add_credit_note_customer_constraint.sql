/*
  # Add Customer Constraint to Credit Notes

  1. Changes
    - Add check constraint to ensure every credit note has either a tenant_id or external_customer_id
    - This prevents orphaned credit notes without a customer
  
  2. Security
    - Maintains data integrity
    - Ensures all credit notes are properly linked to a customer
*/

-- Add constraint to ensure credit note has a customer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'credit_notes_must_have_customer'
  ) THEN
    ALTER TABLE credit_notes
    ADD CONSTRAINT credit_notes_must_have_customer
    CHECK (tenant_id IS NOT NULL OR external_customer_id IS NOT NULL);
  END IF;
END $$;
