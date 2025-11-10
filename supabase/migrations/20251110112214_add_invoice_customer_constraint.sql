/*
  # Add Customer Constraint to Invoices

  1. Changes
    - Add check constraint to ensure every invoice has either a tenant_id or external_customer_id
    - This prevents orphaned invoices without a customer
  
  2. Security
    - Maintains data integrity
    - Ensures all invoices are properly linked to a customer
*/

-- Add constraint to ensure invoice has a customer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_must_have_customer'
  ) THEN
    ALTER TABLE invoices
    ADD CONSTRAINT invoices_must_have_customer
    CHECK (tenant_id IS NOT NULL OR external_customer_id IS NOT NULL);
  END IF;
END $$;
