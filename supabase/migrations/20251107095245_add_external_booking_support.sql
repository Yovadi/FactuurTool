/*
  # Add External Booking Support

  1. Changes
    - Add `booking_type` column to `meeting_room_bookings` table ('tenant' or 'external')
    - Add external contact information columns:
      - `external_company_name` (text)
      - `external_contact_name` (text)
      - `external_email` (text)
      - `external_phone` (text)
    
  2. Notes
    - For tenant bookings: booking_type = 'tenant', tenant_id is required, external fields are null
    - For external bookings: booking_type = 'external', tenant_id is null, external fields are required
    - Default booking_type is 'tenant' for backwards compatibility
*/

-- Add booking type column
ALTER TABLE meeting_room_bookings 
ADD COLUMN IF NOT EXISTS booking_type text DEFAULT 'tenant' CHECK (booking_type IN ('tenant', 'external'));

-- Add external contact columns
ALTER TABLE meeting_room_bookings 
ADD COLUMN IF NOT EXISTS external_company_name text,
ADD COLUMN IF NOT EXISTS external_contact_name text,
ADD COLUMN IF NOT EXISTS external_email text,
ADD COLUMN IF NOT EXISTS external_phone text;

-- Make tenant_id nullable for external bookings
ALTER TABLE meeting_room_bookings 
ALTER COLUMN tenant_id DROP NOT NULL;

-- Add check constraint to ensure proper data based on booking type
ALTER TABLE meeting_room_bookings
DROP CONSTRAINT IF EXISTS booking_type_data_check;

ALTER TABLE meeting_room_bookings
ADD CONSTRAINT booking_type_data_check CHECK (
  (booking_type = 'tenant' AND tenant_id IS NOT NULL) OR
  (booking_type = 'external' AND external_company_name IS NOT NULL)
);