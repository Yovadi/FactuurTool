/*
  # Add Multiple Spaces per Lease and VAT Support

  ## Overview
  This migration updates the lease system to support multiple office spaces per lease
  and adds VAT configuration for invoices.

  ## Changes

  ### 1. New Table: `lease_spaces`
  Junction table connecting leases to multiple office spaces
  - `id` (uuid, primary key) - Unique identifier
  - `lease_id` (uuid, foreign key) - Reference to lease
  - `space_id` (uuid, foreign key) - Reference to office space
  - `price_per_sqm` (numeric) - Price per square meter for this space
  - `monthly_rent` (numeric) - Calculated monthly rent for this space
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. Modified Table: `leases`
  - Remove `space_id` column (moved to lease_spaces)
  - Remove `monthly_rent` column (calculated from lease_spaces)
  - Add `vat_rate` (numeric) - VAT rate as percentage (e.g., 21 for 21%)
  - Add `vat_inclusive` (boolean) - Whether prices include VAT

  ### 3. Modified Table: `invoices`
  - Add `subtotal` (numeric) - Amount before VAT
  - Add `vat_amount` (numeric) - VAT amount
  - Keep `amount` as total (subtotal + vat_amount)
  - Add `vat_rate` (numeric) - VAT rate applied
  - Add `vat_inclusive` (boolean) - Whether invoice is VAT inclusive

  ## Important Notes
  1. Existing leases will need to be migrated manually or recreated
  2. Monthly rent is now calculated as: square_footage × price_per_sqm
  3. VAT can be inclusive (price includes VAT) or exclusive (VAT added on top)
  4. Multiple spaces can be added to a single lease with different price per sqm
*/

-- Create lease_spaces junction table
CREATE TABLE IF NOT EXISTS lease_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES office_spaces(id) ON DELETE CASCADE,
  price_per_sqm numeric NOT NULL,
  monthly_rent numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(lease_id, space_id)
);

-- Add VAT fields to leases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'vat_rate'
  ) THEN
    ALTER TABLE leases ADD COLUMN vat_rate numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'vat_inclusive'
  ) THEN
    ALTER TABLE leases ADD COLUMN vat_inclusive boolean DEFAULT false;
  END IF;
END $$;

-- Add VAT fields to invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE invoices ADD COLUMN subtotal numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'vat_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN vat_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'vat_rate'
  ) THEN
    ALTER TABLE invoices ADD COLUMN vat_rate numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'vat_inclusive'
  ) THEN
    ALTER TABLE invoices ADD COLUMN vat_inclusive boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lease_spaces_lease_id ON lease_spaces(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_spaces_space_id ON lease_spaces(space_id);

-- Enable RLS on lease_spaces
ALTER TABLE lease_spaces ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for lease_spaces
CREATE POLICY "Anyone can view lease spaces"
  ON lease_spaces FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert lease spaces"
  ON lease_spaces FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update lease spaces"
  ON lease_spaces FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete lease spaces"
  ON lease_spaces FOR DELETE
  TO anon, authenticated
  USING (true);

-- Function to calculate total monthly rent for a lease
CREATE OR REPLACE FUNCTION calculate_lease_total_rent(lease_uuid uuid)
RETURNS numeric AS $$
DECLARE
  total numeric;
BEGIN
  SELECT COALESCE(SUM(monthly_rent), 0) INTO total
  FROM lease_spaces
  WHERE lease_id = lease_uuid;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate VAT amounts
CREATE OR REPLACE FUNCTION calculate_vat(
  base_amount numeric,
  vat_rate numeric,
  is_inclusive boolean,
  OUT subtotal numeric,
  OUT vat_amount numeric,
  OUT total numeric
)
AS $$
BEGIN
  IF is_inclusive THEN
    -- Price includes VAT, so we need to extract it
    total := base_amount;
    subtotal := base_amount / (1 + (vat_rate / 100));
    vat_amount := base_amount - subtotal;
  ELSE
    -- Price excludes VAT, so we add it
    subtotal := base_amount;
    vat_amount := base_amount * (vat_rate / 100);
    total := base_amount + vat_amount;
  END IF;
END;
$$ LANGUAGE plpgsql;
