/*
  # Add external_customer_id to invoices table

  1. Changes
    - Add external_customer_id column to invoices table
    - Add foreign key constraint to external_customers table

  2. Notes
    - This allows invoices to be linked to external customers for meeting room bookings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'external_customer_id'
  ) THEN
    ALTER TABLE invoices
    ADD COLUMN external_customer_id uuid REFERENCES external_customers(id);
  END IF;
END $$;
