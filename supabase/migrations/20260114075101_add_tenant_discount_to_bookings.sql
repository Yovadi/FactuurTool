/*
  # Add Tenant Discount Support to Meeting Room Bookings

  1. Changes
    - Add `discount_percentage` column to track discount percentage applied
    - Add `discount_amount` column to track actual discount amount in euros

  2. Business Logic
    - Tenants receive 10% discount on meeting room bookings
    - External customers pay full price (0% discount)
    - Discount is calculated before VAT

  3. Important Notes
    - Discount is applied to subtotal, not final amount
    - The `total_amount` in bookings should be AFTER discount but BEFORE VAT
    - VAT is calculated on the discounted amount
*/

-- Add discount columns to meeting_room_bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_room_bookings' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE meeting_room_bookings ADD COLUMN discount_percentage numeric(5,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_room_bookings' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE meeting_room_bookings ADD COLUMN discount_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add check constraint to ensure discount percentage is valid (0-100%)
ALTER TABLE meeting_room_bookings
DROP CONSTRAINT IF EXISTS meeting_room_bookings_discount_percentage_check;

ALTER TABLE meeting_room_bookings
ADD CONSTRAINT meeting_room_bookings_discount_percentage_check
CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

-- Add check constraint to ensure discount amount is not negative
ALTER TABLE meeting_room_bookings
DROP CONSTRAINT IF EXISTS meeting_room_bookings_discount_amount_check;

ALTER TABLE meeting_room_bookings
ADD CONSTRAINT meeting_room_bookings_discount_amount_check
CHECK (discount_amount >= 0);
