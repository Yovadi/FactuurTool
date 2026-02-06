/*
  # Remove booking_date_not_past constraint

  1. Changes
    - Remove `booking_date_not_past` check constraint from `flex_day_bookings` table
    - This constraint prevented creating bookings for past dates
    - Since this is an admin management tool, administrators need the ability
      to create bookings for any date (including past dates for record-keeping)

  2. Important Notes
    - No data is lost or modified
    - Only the constraint is removed
*/

ALTER TABLE flex_day_bookings DROP CONSTRAINT IF EXISTS booking_date_not_past;
