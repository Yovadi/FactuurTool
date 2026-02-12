/*
  # Add per-line-item category for e-Boekhouden grootboek mapping

  1. Modified Tables
    - `invoice_line_items`
      - Added `local_category` (text, nullable) - stores the category for grootboek mapping
        Valid values: 'huur_kantoor', 'huur_bedrijfsruimte', 'huur_buitenterrein', 
        'diversen', 'vergaderruimte', 'flexplek', or NULL (falls back to default mapping)

  2. Purpose
    - Allows each line item on an invoice to map to a different grootboekrekening
    - Invoices with both kantoor and bedrijfsruimte lines will correctly split
      across multiple ledger accounts when synced to e-Boekhouden
    - NULL values fall back to the 'default' mapping for backwards compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_line_items' AND column_name = 'local_category'
  ) THEN
    ALTER TABLE invoice_line_items ADD COLUMN local_category text;
  END IF;
END $$;
