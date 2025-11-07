/*
  # Add Address Fields for External Bookings

  1. Changes
    - Add address fields to `meeting_room_bookings` table for external bookings:
      - `external_street` (text) - Street name and number
      - `external_postal_code` (text) - Postal/ZIP code
      - `external_city` (text) - City name
      - `external_country` (text) - Country, defaults to 'Nederland'
    
  2. Notes
    - These fields are required for invoicing external parties
    - Only needed when booking_type = 'external'
*/

-- Add address columns for external bookings
ALTER TABLE meeting_room_bookings 
ADD COLUMN IF NOT EXISTS external_street text,
ADD COLUMN IF NOT EXISTS external_postal_code text,
ADD COLUMN IF NOT EXISTS external_city text,
ADD COLUMN IF NOT EXISTS external_country text DEFAULT 'Nederland';