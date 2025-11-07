/*
  # Add booking_type column to meeting_room_bookings

  1. Changes
    - Add booking_type column to meeting_room_bookings table
    - Default value is 'tenant' for backward compatibility
    - Allows values: 'tenant' or 'external'

  2. Notes
    - This column distinguishes between tenant bookings and external customer bookings
    - Existing bookings will be marked as 'tenant' type
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_room_bookings' AND column_name = 'booking_type'
  ) THEN
    ALTER TABLE meeting_room_bookings
    ADD COLUMN booking_type text DEFAULT 'tenant' CHECK (booking_type IN ('tenant', 'external'));
  END IF;
END $$;
