/*
  # Remove old external booking fields

  1. Changes
    - Drop old external booking fields from meeting_room_bookings table
    - These fields are replaced by external_customer_id relationship:
      - booking_type
      - external_company_name
      - external_contact_name
      - external_email
      - external_phone
      - external_street
      - external_postal_code
      - external_city
      - external_country

  Note: This migration assumes data has been migrated to external_customers table
*/

-- Drop old external booking fields
ALTER TABLE meeting_room_bookings
  DROP COLUMN IF EXISTS booking_type,
  DROP COLUMN IF EXISTS external_company_name,
  DROP COLUMN IF EXISTS external_contact_name,
  DROP COLUMN IF EXISTS external_email,
  DROP COLUMN IF EXISTS external_phone,
  DROP COLUMN IF EXISTS external_street,
  DROP COLUMN IF EXISTS external_postal_code,
  DROP COLUMN IF EXISTS external_city,
  DROP COLUMN IF EXISTS external_country;
