/*
  # Make VAT Rate Nullable in Meeting Room Bookings

  ## Overview
  This migration makes the VAT rate optional in meeting room bookings, as the VAT rate will now be selected during invoice generation rather than when creating the booking.

  ## Changes
  
  ### Modified Tables
  - `meeting_room_bookings`
    - Changed `vat_rate` to be nullable (removed NOT NULL constraint)
    - Removed default value
  
  ## Notes
  - The VAT rate will now be determined at invoice generation time
  - Existing bookings will retain their VAT rates
  - New bookings will have NULL vat_rate until an invoice is generated
*/

-- Make vat_rate nullable and remove default
ALTER TABLE meeting_room_bookings 
  ALTER COLUMN vat_rate DROP NOT NULL,
  ALTER COLUMN vat_rate DROP DEFAULT;