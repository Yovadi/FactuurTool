/*
  # Add discount percentage to tenants and external customers

  1. Changes to tenants table
    - Add `discount_percentage` column (numeric, default 10)
      - Stores the discount percentage that applies to this tenant for meeting room bookings
      - Default is 10% for existing and new tenants
  
  2. Changes to external_customers table
    - Add `discount_percentage` column (numeric, default 0)
      - Stores the discount percentage that applies to this external customer
      - Default is 0% (no discount) for external customers
  
  3. Notes
    - Existing tenants will automatically get 10% discount
    - Existing external customers will get 0% discount
    - Can be customized per tenant/customer as needed
*/

-- Add discount_percentage to tenants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE tenants ADD COLUMN discount_percentage numeric(5,2) DEFAULT 10 NOT NULL;
  END IF;
END $$;

-- Add discount_percentage to external_customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_customers' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE external_customers ADD COLUMN discount_percentage numeric(5,2) DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add check constraint to ensure discount_percentage is between 0 and 100
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_discount_percentage_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_discount_percentage_check 
  CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

ALTER TABLE external_customers DROP CONSTRAINT IF EXISTS external_customers_discount_percentage_check;
ALTER TABLE external_customers ADD CONSTRAINT external_customers_discount_percentage_check 
  CHECK (discount_percentage >= 0 AND discount_percentage <= 100);