/*
  # Add Booking PIN Code to Company Settings

  1. Changes
    - Add `booking_pin_code` column to `company_settings` table
    - Column is nullable to allow gradual adoption
    - 4-digit PIN code for protecting the booking calendar
    
  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'booking_pin_code'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN booking_pin_code text;
  END IF;
END $$;