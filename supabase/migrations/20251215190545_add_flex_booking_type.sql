/*
  # Add flex booking type support

  ## Overview
  This migration extends the booking system to support flex workspace bookings alongside
  meeting room bookings (tenant) and external customer bookings.

  ## Changes
  
  1. Booking Type Extension
    - Extends `booking_type` CHECK constraint to include 'flex' as a valid option
    - Options: 'tenant' (meeting room), 'external' (external customer), 'flex' (flex workspace)
  
  2. Consistency Check Update
    - Updates booking_type consistency constraint to handle flex bookings
    - Flex bookings: tenant_id IS NOT NULL, external_customer_id IS NULL
    - Same rules as tenant bookings but distinguishes purpose
  
  ## Notes
  - Flex bookings use tenant_id since flex huurders are stored in tenants table
  - This allows easy tracking of flex workspace usage vs meeting room usage
  - Existing bookings remain unchanged (backward compatible)
*/

-- Drop the existing constraints
ALTER TABLE meeting_room_bookings
DROP CONSTRAINT IF EXISTS meeting_room_bookings_booking_type_check;

ALTER TABLE meeting_room_bookings
DROP CONSTRAINT IF EXISTS check_booking_type_consistency;

-- Add updated booking_type constraint with 'flex' option
ALTER TABLE meeting_room_bookings
ADD CONSTRAINT meeting_room_bookings_booking_type_check 
CHECK (booking_type IN ('tenant', 'external', 'flex'));

-- Add updated consistency check that handles flex bookings
ALTER TABLE meeting_room_bookings
ADD CONSTRAINT check_booking_type_consistency CHECK (
  (booking_type = 'tenant' AND tenant_id IS NOT NULL AND external_customer_id IS NULL) OR
  (booking_type = 'external' AND external_customer_id IS NOT NULL AND tenant_id IS NULL) OR
  (booking_type = 'flex' AND tenant_id IS NOT NULL AND external_customer_id IS NULL)
);
