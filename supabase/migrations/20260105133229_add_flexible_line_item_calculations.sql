/*
  # Add Flexible Invoice Line Item Calculations

  ## Overview
  This migration adds support for multiple calculation methods for invoice line items,
  allowing for more flexible invoicing (fixed price, quantity-based, m²-based, hourly, etc.).

  ## Changes

  ### Modified Tables
  
  #### `invoice_line_items`
  - Added `calculation_type` (text) - Type of calculation: 'quantity_price' or 'fixed'
    - 'quantity_price': amount = quantity × unit_price (used for m², hours, items, etc.)
    - 'fixed': amount = unit_price (direct fixed amount)
  - Added `quantity_label` (text, optional) - Label for quantity field (e.g., "m²", "Aantal", "Uren")
  - Made `quantity` nullable for fixed-price items
  - Set default values for backward compatibility

  ## Important Notes
  1. Existing records will default to 'quantity_price' calculation type
  2. Quantity label defaults to "Aantal" for quantity-based calculations
  3. For fixed-price items, quantity can be null and unit_price contains the full amount
*/

-- Add calculation_type column with default value for backward compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_line_items' AND column_name = 'calculation_type'
  ) THEN
    ALTER TABLE invoice_line_items 
    ADD COLUMN calculation_type text NOT NULL DEFAULT 'quantity_price'
    CHECK (calculation_type IN ('quantity_price', 'fixed'));
  END IF;
END $$;

-- Add quantity_label column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_line_items' AND column_name = 'quantity_label'
  ) THEN
    ALTER TABLE invoice_line_items 
    ADD COLUMN quantity_label text;
  END IF;
END $$;

-- Update existing records to have default quantity label
UPDATE invoice_line_items 
SET quantity_label = 'Aantal'
WHERE quantity_label IS NULL 
  AND calculation_type = 'quantity_price'
  AND quantity IS NOT NULL;

-- Make quantity nullable (it should already be nullable from original migration, but we ensure it)
ALTER TABLE invoice_line_items 
ALTER COLUMN quantity DROP NOT NULL;