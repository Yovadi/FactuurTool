/*
  # Add order number to purchase invoices

  1. Modified Tables
    - `purchase_invoices`
      - Added `order_number` (text, default empty string) - stores the order/purchase order number from the invoice if present

  2. Notes
    - Non-destructive change, only adds a new column
    - Default empty string so existing rows are unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_invoices' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE purchase_invoices ADD COLUMN order_number text DEFAULT '';
  END IF;
END $$;