/*
  # Fix Flex Day Bookings RLS for Anonymous Access

  ## Changes
  Updates the RLS policies on flex_day_bookings table to allow anonymous (anon) access
  instead of only authenticated users, matching the access pattern used throughout
  the application.

  ## Modified Policies
  - Changed all policies from "TO authenticated" to "TO anon"
  - Allows the application to create, read, update, and delete flex day bookings
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view flex day bookings" ON flex_day_bookings;
DROP POLICY IF EXISTS "Anyone can insert flex day bookings" ON flex_day_bookings;
DROP POLICY IF EXISTS "Anyone can update flex day bookings" ON flex_day_bookings;
DROP POLICY IF EXISTS "Anyone can delete flex day bookings" ON flex_day_bookings;

-- Create new policies with anon access
CREATE POLICY "Anyone can view flex day bookings"
  ON flex_day_bookings FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert flex day bookings"
  ON flex_day_bookings FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update flex day bookings"
  ON flex_day_bookings FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete flex day bookings"
  ON flex_day_bookings FOR DELETE
  TO anon
  USING (true);
