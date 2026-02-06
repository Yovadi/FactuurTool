/*
  # Add VAT Rate Support to Meeting Room Bookings

  ## Overview
  This migration adds VAT rate configuration to meeting room bookings, allowing users to specify 0% VAT or other VAT rates per booking.

  ## Changes
  
  ### Modified Tables
  - `meeting_room_bookings`
    - Added `vat_rate` (numeric) - VAT percentage to apply to this booking (default 21)
  
  ## Notes
  - Default VAT rate is set to 21% to maintain backward compatibility with existing bookings
  - This allows for flexible VAT rates including 0% for VAT-exempt bookings
  - The vat_rate field will be used when generating invoices for the booking
*/

-- Add vat_rate column to meeting_room_bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_room_bookings' AND column_name = 'vat_rate'
  ) THEN
    ALTER TABLE meeting_room_bookings ADD COLUMN vat_rate numeric(5, 2) NOT NULL DEFAULT 21;
  END IF;
END $$;