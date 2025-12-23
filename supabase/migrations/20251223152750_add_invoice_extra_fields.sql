/*
  # Add extra fields to invoices table
  
  1. Changes
    - Add `reference_number` field for custom reference/kenmerk
    - Add `payment_term_days` field for custom payment terms (default 14)
    - Add `external_customer_id` field already exists, but ensure it's properly nullable
    - Add `vat_rate` and `vat_inclusive` are already present
    
  2. Notes
    - These fields allow more flexibility for manual invoices
    - `reference_number` can be used for project numbers or customer references
    - `payment_term_days` allows customization of payment deadline
*/

-- Add reference_number field if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'reference_number'
  ) THEN
    ALTER TABLE invoices ADD COLUMN reference_number text;
  END IF;
END $$;

-- Add payment_term_days field if it doesn't exist (default 14 days)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_term_days'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_term_days integer DEFAULT 14;
  END IF;
END $$;

-- Add custom_vat_rate field for manual invoice override (if different from lease/default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'custom_vat_rate'
  ) THEN
    ALTER TABLE invoices ADD COLUMN custom_vat_rate decimal(5,2);
  END IF;
END $$;

-- Add custom_vat_inclusive field for manual invoice override
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'custom_vat_inclusive'
  ) THEN
    ALTER TABLE invoices ADD COLUMN custom_vat_inclusive boolean;
  END IF;
END $$;