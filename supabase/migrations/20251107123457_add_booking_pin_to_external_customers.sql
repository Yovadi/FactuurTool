/*
  # Add booking_pin_code to external_customers

  1. Changes
    - Add booking_pin_code field to external_customers table for self-service booking access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_customers' AND column_name = 'booking_pin_code'
  ) THEN
    ALTER TABLE external_customers
    ADD COLUMN booking_pin_code text;
  END IF;
END $$;
