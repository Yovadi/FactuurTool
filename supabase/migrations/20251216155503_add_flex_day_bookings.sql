/*
  # Add Flex Day Bookings System

  ## Overview
  Adds support for flexible day-by-day bookings for flex workspace tenants.
  This allows tenants with monthly credit limits (e.g., 10 days per month) to book
  specific dates rather than fixed weekly schedules.

  ## New Tables
  
  ### `flex_day_bookings`
  Tracks individual day bookings for flex workspace tenants
  - `id` (uuid, primary key)
  - `lease_id` (uuid, references leases) - The flex lease contract
  - `space_id` (uuid, references office_spaces) - Which space is booked
  - `booking_date` (date) - The specific date being booked
  - `is_half_day` (boolean) - Whether this is a half-day booking
  - `created_at` (timestamptz) - When the booking was created
  - `created_by` (text) - Who created the booking
  
  ## Constraints
  - Unique constraint on (lease_id, space_id, booking_date) to prevent double bookings
  - Check constraint to ensure booking_date is not in the past
  - Foreign key constraints with CASCADE delete

  ## Indexes
  - Index on (lease_id, booking_date) for fast queries of tenant bookings
  - Index on (space_id, booking_date) for occupancy calculations
  
  ## Security
  - Enable RLS on flex_day_bookings table
  - Allow authenticated users to read all bookings
  - Allow authenticated users to insert/update/delete bookings

  ## Functions
  - Helper function to calculate monthly credit usage for a lease
*/

-- Create flex_day_bookings table
CREATE TABLE IF NOT EXISTS flex_day_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES office_spaces(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  is_half_day boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by text,
  
  CONSTRAINT unique_flex_booking UNIQUE (lease_id, space_id, booking_date),
  CONSTRAINT booking_date_not_past CHECK (booking_date >= CURRENT_DATE)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_flex_bookings_lease_date 
  ON flex_day_bookings(lease_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_flex_bookings_space_date 
  ON flex_day_bookings(space_id, booking_date);

-- Enable RLS
ALTER TABLE flex_day_bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view flex day bookings"
  ON flex_day_bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert flex day bookings"
  ON flex_day_bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update flex day bookings"
  ON flex_day_bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete flex day bookings"
  ON flex_day_bookings FOR DELETE
  TO authenticated
  USING (true);

-- Function to calculate monthly credit usage for a lease
CREATE OR REPLACE FUNCTION get_flex_credits_used(
  p_lease_id uuid,
  p_year int,
  p_month int
)
RETURNS numeric AS $$
DECLARE
  v_credits_used numeric;
  v_day_type text;
BEGIN
  -- Get the lease's day type (full or half)
  SELECT flex_day_type INTO v_day_type
  FROM leases
  WHERE id = p_lease_id;

  -- Calculate credits used in the specified month
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN v_day_type = 'half_day' AND is_half_day THEN 0.5
        WHEN v_day_type = 'half_day' AND NOT is_half_day THEN 1.0
        ELSE 1.0
      END
    ),
    0
  ) INTO v_credits_used
  FROM flex_day_bookings
  WHERE lease_id = p_lease_id
    AND EXTRACT(YEAR FROM booking_date) = p_year
    AND EXTRACT(MONTH FROM booking_date) = p_month;

  RETURN v_credits_used;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a booking would exceed monthly credit limit
CREATE OR REPLACE FUNCTION check_flex_credit_limit()
RETURNS trigger AS $$
DECLARE
  v_credits_per_month int;
  v_credits_used numeric;
  v_booking_year int;
  v_booking_month int;
  v_day_type text;
  v_new_credit_cost numeric;
BEGIN
  -- Get lease details
  SELECT flex_credits_per_month, flex_day_type
  INTO v_credits_per_month, v_day_type
  FROM leases
  WHERE id = NEW.lease_id;

  -- If no credit limit, allow booking
  IF v_credits_per_month IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extract year and month from booking date
  v_booking_year := EXTRACT(YEAR FROM NEW.booking_date);
  v_booking_month := EXTRACT(MONTH FROM NEW.booking_date);

  -- Calculate current credits used in this month (excluding this booking if update)
  SELECT COALESCE(
    SUM(
      CASE 
        WHEN v_day_type = 'half_day' AND is_half_day THEN 0.5
        WHEN v_day_type = 'half_day' AND NOT is_half_day THEN 1.0
        ELSE 1.0
      END
    ),
    0
  ) INTO v_credits_used
  FROM flex_day_bookings
  WHERE lease_id = NEW.lease_id
    AND EXTRACT(YEAR FROM booking_date) = v_booking_year
    AND EXTRACT(MONTH FROM booking_date) = v_booking_month
    AND (TG_OP = 'INSERT' OR id != NEW.id);

  -- Calculate cost of new/updated booking
  v_new_credit_cost := CASE 
    WHEN v_day_type = 'half_day' AND NEW.is_half_day THEN 0.5
    ELSE 1.0
  END;

  -- Check if booking would exceed limit
  IF v_credits_used + v_new_credit_cost > v_credits_per_month THEN
    RAISE EXCEPTION 'Booking would exceed monthly credit limit of % (currently used: %, attempting to add: %)',
      v_credits_per_month, v_credits_used, v_new_credit_cost;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce credit limit
DROP TRIGGER IF EXISTS enforce_flex_credit_limit ON flex_day_bookings;
CREATE TRIGGER enforce_flex_credit_limit
  BEFORE INSERT OR UPDATE ON flex_day_bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_flex_credit_limit();