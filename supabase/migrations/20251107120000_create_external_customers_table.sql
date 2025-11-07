/*
  # Create External Customers Table

  1. New Tables
    - `external_customers`
      - `id` (uuid, primary key)
      - `company_name` (text) - Company name
      - `contact_name` (text) - Contact person name
      - `email` (text, optional) - Contact email
      - `phone` (text, optional) - Contact phone
      - `street` (text) - Street address
      - `postal_code` (text) - Postal code
      - `city` (text) - City
      - `country` (text) - Country, defaults to 'Nederland'
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `external_customers` table
    - Add policy for anonymous access (same as tenants and other booking-related tables)

  3. Changes to meeting_room_bookings
    - Add `external_customer_id` foreign key to external_customers table
    - Keep existing external fields temporarily for migration
*/

-- Create external_customers table
CREATE TABLE IF NOT EXISTS external_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text,
  phone text,
  street text NOT NULL,
  postal_code text NOT NULL,
  city text NOT NULL,
  country text NOT NULL DEFAULT 'Nederland',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE external_customers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (same as tenants for booking system)
CREATE POLICY "Allow anonymous read access to external_customers"
  ON external_customers
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert to external_customers"
  ON external_customers
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update to external_customers"
  ON external_customers
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete from external_customers"
  ON external_customers
  FOR DELETE
  TO anon
  USING (true);

-- Add external_customer_id to meeting_room_bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_room_bookings' AND column_name = 'external_customer_id'
  ) THEN
    ALTER TABLE meeting_room_bookings
    ADD COLUMN external_customer_id uuid REFERENCES external_customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meeting_room_bookings_external_customer_id
  ON meeting_room_bookings(external_customer_id);
