/*
  # Add Pending Status to Meeting Room Bookings

  1. Changes
    - Drop existing status check constraint
    - Add new status check constraint including 'pending' status
    - Change default status from 'confirmed' to 'pending'
    - Update existing 'confirmed' bookings to 'pending' if they don't have an invoice yet
  
  2. Status Flow
    - pending: Initial state when user creates booking
    - confirmed: When landlord confirms the booking
    - completed: When booking is finished and invoiced
    - cancelled: When booking is cancelled
  
  3. Security
    - Users can only delete/update their own bookings when status is 'pending'
    - Landlord can update status to 'confirmed', 'completed', or 'cancelled'
*/

-- Drop existing status constraint
ALTER TABLE meeting_room_bookings 
DROP CONSTRAINT IF EXISTS meeting_room_bookings_status_check;

-- Add new status constraint with 'pending'
ALTER TABLE meeting_room_bookings
ADD CONSTRAINT meeting_room_bookings_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text]));

-- Change default status to 'pending'
ALTER TABLE meeting_room_bookings 
ALTER COLUMN status SET DEFAULT 'pending'::text;

-- Update existing bookings without invoice to 'pending'
-- (bookings with invoice should stay as they are)
UPDATE meeting_room_bookings
SET status = 'pending'
WHERE status = 'confirmed' 
  AND invoice_id IS NULL
  AND booking_date >= CURRENT_DATE;
