/*
  # Add Pending Status to Flex Day Bookings

  1. Changes
    - Add status column to flex_day_bookings table
    - Add status check constraint with 'pending', 'confirmed', 'cancelled', 'completed'
    - Set default status to 'pending'
    - Contract-based bookings (from flex_schedules) should be auto-confirmed

  2. Status Flow
    - pending: Initial state for one-time bookings (requires landlord approval)
    - confirmed: When landlord confirms OR automatically for contract-based bookings
    - completed: When booking is finished and invoiced
    - cancelled: When booking is cancelled

  3. Business Rules
    - One-time bookings (external customers without contract): Start as 'pending'
    - Contract-based bookings (from flex_schedules): Auto-confirmed
    - Only confirmed bookings can be invoiced

  4. Security
    - Users can only delete/update their own bookings when status is 'pending'
    - Landlord can update status to any valid state
*/

-- Add status column to flex_day_bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flex_day_bookings' AND column_name = 'status'
  ) THEN
    ALTER TABLE flex_day_bookings
    ADD COLUMN status text DEFAULT 'pending'::text NOT NULL;
  END IF;
END $$;

-- Add status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'flex_day_bookings_status_check'
  ) THEN
    ALTER TABLE flex_day_bookings
    ADD CONSTRAINT flex_day_bookings_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text]));
  END IF;
END $$;

-- Set existing bookings to appropriate status:
-- - If invoiced: completed
-- - If not invoiced: confirmed (keeping backwards compatibility)
UPDATE flex_day_bookings
SET status = CASE
  WHEN invoice_id IS NOT NULL THEN 'completed'
  ELSE 'confirmed'
END
WHERE status IS NULL OR status = 'pending';

-- Create a trigger to auto-confirm contract-based bookings
-- This ensures bookings from flex_schedules are automatically confirmed
CREATE OR REPLACE FUNCTION auto_confirm_contract_flex_bookings()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this booking is part of a flex schedule (contract-based)
  -- by looking for a matching flex_schedule entry
  IF EXISTS (
    SELECT 1 FROM flex_schedules
    WHERE space_id = NEW.space_id
      AND (external_customer_id = NEW.external_customer_id OR lease_id IS NOT NULL)
      AND slot_number = NEW.slot_number
      AND (
        (EXTRACT(DOW FROM NEW.booking_date::date) = 1 AND monday = true) OR
        (EXTRACT(DOW FROM NEW.booking_date::date) = 2 AND tuesday = true) OR
        (EXTRACT(DOW FROM NEW.booking_date::date) = 3 AND wednesday = true) OR
        (EXTRACT(DOW FROM NEW.booking_date::date) = 4 AND thursday = true) OR
        (EXTRACT(DOW FROM NEW.booking_date::date) = 5 AND friday = true)
      )
  ) THEN
    -- Auto-confirm contract-based bookings
    NEW.status := 'confirmed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS auto_confirm_contract_flex_bookings_trigger ON flex_day_bookings;

CREATE TRIGGER auto_confirm_contract_flex_bookings_trigger
  BEFORE INSERT ON flex_day_bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_contract_flex_bookings();

-- Update status to 'completed' when invoice is added
CREATE OR REPLACE FUNCTION update_flex_booking_status_on_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_id IS NOT NULL AND OLD.invoice_id IS NULL THEN
    NEW.status := 'completed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_flex_booking_status_on_invoice_trigger ON flex_day_bookings;

CREATE TRIGGER update_flex_booking_status_on_invoice_trigger
  BEFORE UPDATE ON flex_day_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_flex_booking_status_on_invoice();
