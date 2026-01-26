/*
  # Add half-day period to flex bookings

  1. Changes
    - Add `half_day_period` column to `flex_day_bookings` table
    - Values: 'morning' (ochtend) or 'afternoon' (middag)
    - NULL for full day bookings
    - Update unique constraint to allow both morning and afternoon bookings

  2. Notes
    - Allows tracking which part of the day is booked
    - A flexer can book both morning AND afternoon as separate half-days
*/

ALTER TABLE flex_day_bookings
ADD COLUMN IF NOT EXISTS half_day_period text;

ALTER TABLE flex_day_bookings
DROP CONSTRAINT IF EXISTS flex_day_bookings_lease_id_space_id_booking_date_key;

ALTER TABLE flex_day_bookings
ADD CONSTRAINT flex_day_bookings_unique_booking 
UNIQUE (lease_id, space_id, booking_date, half_day_period);

ALTER TABLE flex_day_bookings
ADD CONSTRAINT flex_day_bookings_half_day_period_check 
CHECK (half_day_period IS NULL OR half_day_period IN ('morning', 'afternoon'));