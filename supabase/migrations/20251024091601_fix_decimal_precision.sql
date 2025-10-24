/*
  # Fix Decimal Precision to 2 Decimals

  ## Changes
  1. Update all monetary columns to use NUMERIC(10,2) to enforce 2 decimal places
  2. Round existing values to 2 decimal places
  3. Tables affected:
    - invoices: amount, subtotal, vat_amount, vat_rate
    - invoice_line_items: amount, quantity, unit_price
    - leases: security_deposit, vat_rate
    - office_spaces: base_rent, square_footage

  ## Notes
  - This ensures all monetary calculations use exactly 2 decimal places
  - Prevents floating point precision issues
  - Existing data is preserved but rounded to 2 decimals
*/

-- Update invoices table
ALTER TABLE invoices 
  ALTER COLUMN amount TYPE NUMERIC(10,2) USING ROUND(amount::numeric, 2),
  ALTER COLUMN subtotal TYPE NUMERIC(10,2) USING ROUND(subtotal::numeric, 2),
  ALTER COLUMN vat_amount TYPE NUMERIC(10,2) USING ROUND(vat_amount::numeric, 2),
  ALTER COLUMN vat_rate TYPE NUMERIC(5,2) USING ROUND(vat_rate::numeric, 2);

-- Update invoice_line_items table
ALTER TABLE invoice_line_items
  ALTER COLUMN amount TYPE NUMERIC(10,2) USING ROUND(amount::numeric, 2),
  ALTER COLUMN quantity TYPE NUMERIC(10,2) USING ROUND(quantity::numeric, 2),
  ALTER COLUMN unit_price TYPE NUMERIC(10,2) USING ROUND(unit_price::numeric, 2);

-- Update leases table
ALTER TABLE leases
  ALTER COLUMN security_deposit TYPE NUMERIC(10,2) USING ROUND(security_deposit::numeric, 2),
  ALTER COLUMN vat_rate TYPE NUMERIC(5,2) USING ROUND(vat_rate::numeric, 2);

-- Update office_spaces table
ALTER TABLE office_spaces
  ALTER COLUMN base_rent TYPE NUMERIC(10,2) USING ROUND(base_rent::numeric, 2),
  ALTER COLUMN square_footage TYPE NUMERIC(10,2) USING ROUND(square_footage::numeric, 2);