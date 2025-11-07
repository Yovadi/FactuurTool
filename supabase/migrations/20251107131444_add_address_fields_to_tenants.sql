/*
  # Add separate address fields to tenants table

  1. Changes
    - Add street, postal_code, city, and country fields to tenants table
    - Keep billing_address for backward compatibility (can be deprecated later)

  2. Notes
    - New fields allow structured address input like external_customers
    - Improves address validation and formatting
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'street'
  ) THEN
    ALTER TABLE tenants
    ADD COLUMN street text,
    ADD COLUMN postal_code text,
    ADD COLUMN city text,
    ADD COLUMN country text DEFAULT 'Nederland';
  END IF;
END $$;
