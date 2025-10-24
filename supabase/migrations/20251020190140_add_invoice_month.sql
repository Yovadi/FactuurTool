/*
  # Add invoice month to invoices table

  1. Changes
    - Add `invoice_month` column to `invoices` table
      - Stores the month for which the invoice is generated (YYYY-MM format)
      - This is always 1 month ahead of the invoice date
    
  2. Notes
    - Existing invoices will have NULL for invoice_month (can be updated manually if needed)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'invoice_month'
  ) THEN
    ALTER TABLE invoices ADD COLUMN invoice_month text;
  END IF;
END $$;