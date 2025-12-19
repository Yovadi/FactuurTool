/*
  # Fix Flex Credit Limit Trigger for Weekly Credits
  
  ## Problem
  The trigger function `check_flex_credit_limit()` was still checking monthly limits
  even after the column was renamed from `credits_per_month` to `credits_per_week`.
  This caused errors when trying to book days for the entire contract period.
  
  ## Changes
  1. Update `check_flex_credit_limit()` function to check WEEKLY limits instead of monthly
  2. Update `get_flex_credits_used()` function to calculate weekly usage
  3. Both functions now properly use the `credits_per_week` column
  
  ## Details
  - Changed from checking monthly usage to weekly usage
  - Weekly periods are calculated from Monday to Sunday
  - The trigger now correctly validates against weekly credit limits
*/

-- Function to calculate weekly credit usage for a lease
CREATE OR REPLACE FUNCTION get_flex_credits_used_weekly(
  p_lease_id uuid,
  p_date date
)
RETURNS numeric AS $$
DECLARE
  v_credits_used numeric;
  v_day_type text;
  v_week_start date;
  v_week_end date;
BEGIN
  -- Calculate week boundaries (Monday to Sunday)
  v_week_start := p_date - (EXTRACT(DOW FROM p_date)::int + 6) % 7;
  v_week_end := v_week_start + 6;

  -- Get the lease's day type (full or half)
  SELECT flex_day_type INTO v_day_type
  FROM leases
  WHERE id = p_lease_id;

  -- Calculate credits used in the specified week
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
    AND booking_date >= v_week_start
    AND booking_date <= v_week_end;

  RETURN v_credits_used;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a booking would exceed weekly credit limit
CREATE OR REPLACE FUNCTION check_flex_credit_limit()
RETURNS trigger AS $$
DECLARE
  v_credits_per_week int;
  v_credits_used numeric;
  v_day_type text;
  v_new_credit_cost numeric;
  v_week_start date;
  v_week_end date;
BEGIN
  -- Get lease details - NOW USING credits_per_week instead of flex_credits_per_month
  SELECT credits_per_week, flex_day_type
  INTO v_credits_per_week, v_day_type
  FROM leases
  WHERE id = NEW.lease_id;

  -- If no credit limit, allow booking
  IF v_credits_per_week IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate week boundaries (Monday to Sunday)
  v_week_start := NEW.booking_date - (EXTRACT(DOW FROM NEW.booking_date)::int + 6) % 7;
  v_week_end := v_week_start + 6;

  -- Calculate current credits used in this week (excluding this booking if update)
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
    AND booking_date >= v_week_start
    AND booking_date <= v_week_end
    AND (TG_OP = 'INSERT' OR id != NEW.id);

  -- Calculate cost of new/updated booking
  v_new_credit_cost := CASE 
    WHEN v_day_type = 'half_day' AND NEW.is_half_day THEN 0.5
    ELSE 1.0
  END;

  -- Check if booking would exceed limit
  IF v_credits_used + v_new_credit_cost > v_credits_per_week THEN
    RAISE EXCEPTION 'Booking would exceed weekly credit limit of % (currently used: %, attempting to add: %)',
      v_credits_per_week, v_credits_used, v_new_credit_cost;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to use updated function
DROP TRIGGER IF EXISTS enforce_flex_credit_limit ON flex_day_bookings;
CREATE TRIGGER enforce_flex_credit_limit
  BEFORE INSERT OR UPDATE ON flex_day_bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_flex_credit_limit();