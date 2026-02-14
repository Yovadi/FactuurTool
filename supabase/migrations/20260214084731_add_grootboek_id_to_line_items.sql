/*
  # Add grootboek_id to line items tables

  1. Changes
    - Add `grootboek_id` (integer, nullable) to `invoice_line_items`
      - Stores the e-Boekhouden grootboek ledger ID for this specific line
      - If null, the system will determine it automatically from local_category mapping
    - Add `grootboek_id` (integer, nullable) to `purchase_invoice_line_items`
      - Same purpose as for invoice line items
    - Add `grootboek_id` (integer, nullable) to `credit_note_line_items`
      - Same purpose as for invoice line items

  2. Purpose
    - Allow users to manually override the grootboek account per line item
    - System automatically determines grootboek from local_category mapping
    - User can manually change it when editing invoices
*/

-- Add grootboek_id to invoice_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_line_items' AND column_name = 'grootboek_id'
  ) THEN
    ALTER TABLE invoice_line_items ADD COLUMN grootboek_id integer;
  END IF;
END $$;

-- Add grootboek_id to purchase_invoice_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_invoice_line_items' AND column_name = 'grootboek_id'
  ) THEN
    ALTER TABLE purchase_invoice_line_items ADD COLUMN grootboek_id integer;
  END IF;
END $$;

-- Add grootboek_id to credit_note_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_note_line_items' AND column_name = 'grootboek_id'
  ) THEN
    ALTER TABLE credit_note_line_items ADD COLUMN grootboek_id integer;
  END IF;
END $$;
