/*
  # Fix monthly_rent precision in lease_spaces table

  1. Changes
    - Update monthly_rent column to use NUMERIC(10,2)
    - Round existing values to 2 decimal places

  2. Notes
    - This ensures monthly_rent uses exactly 2 decimal places
    - Prevents calculation issues when creating invoices
*/

-- Update lease_spaces table monthly_rent column
ALTER TABLE lease_spaces
  ALTER COLUMN monthly_rent TYPE NUMERIC(10,2) USING ROUND(monthly_rent::numeric, 2);