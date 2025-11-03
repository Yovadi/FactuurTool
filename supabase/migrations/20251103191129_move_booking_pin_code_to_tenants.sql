/*
  # Move Booking PIN Code to Tenants

  1. Changes
    - Remove `booking_pin_code` column from `company_settings` table
    - Add `booking_pin_code` column to `tenants` table
    - Each tenant gets their own 4-digit PIN for making bookings
    
  2. Security
    - No changes to RLS policies needed
*/

-- Remove booking_pin_code from company_settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'booking_pin_code'
  ) THEN
    ALTER TABLE company_settings DROP COLUMN booking_pin_code;
  END IF;
END $$;

-- Add booking_pin_code to tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'booking_pin_code'
  ) THEN
    ALTER TABLE tenants ADD COLUMN booking_pin_code text;
  END IF;
END $$;