/*
  # Revert Flexible Invoice Line Item Calculations

  ## Overview
  This migration reverts the flexible calculation feature and ensures all existing
  invoice line items have proper default values to maintain data integrity.

  ## Changes
  
  ### Updated Tables
  
  #### `invoice_line_items`
  - Set default value for `calculation_type` to 'quantity_price' for all existing records
  - Set default value for `quantity_label` to 'Aantal' where applicable
  - Ensure all NULL quantities are set to 1 for existing records
  - Make quantity NOT NULL again with default value of 1

  ## Important Notes
  1. All existing invoice line items will be preserved with safe defaults
  2. Future inserts will require proper quantity values
  3. This migration is safe and non-destructive
*/

-- Update any NULL quantities to 1 for existing records
UPDATE invoice_line_items 
SET quantity = 1
WHERE quantity IS NULL;

-- Ensure all records have calculation_type set
UPDATE invoice_line_items 
SET calculation_type = 'quantity_price'
WHERE calculation_type IS NULL;

-- Set quantity_label for existing records without one
UPDATE invoice_line_items 
SET quantity_label = 'Aantal'
WHERE quantity_label IS NULL 
  AND calculation_type = 'quantity_price'
  AND quantity IS NOT NULL;

-- Now make quantity NOT NULL with default
ALTER TABLE invoice_line_items 
ALTER COLUMN quantity SET DEFAULT 1,
ALTER COLUMN quantity SET NOT NULL;