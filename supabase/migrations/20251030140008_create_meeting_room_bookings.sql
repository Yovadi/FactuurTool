/*
  # Create Meeting Room Bookings System

  ## Overview
  This migration creates a booking system for meeting rooms that are rented on-demand
  rather than through fixed lease agreements.

  ## New Tables
  
  ### `meeting_room_bookings`
  Stores individual bookings for meeting rooms with flexible scheduling
  
  - `id` (uuid, primary key) - Unique booking identifier
  - `space_id` (uuid, foreign key) - References the meeting room from office_spaces
  - `tenant_id` (uuid, foreign key) - References the tenant making the booking
  - `booking_date` (date) - Date of the booking
  - `start_time` (time) - Start time of the booking
  - `end_time` (time) - End time of the booking
  - `hourly_rate` (numeric) - Rate per hour for this booking
  - `total_hours` (numeric) - Total hours booked
  - `total_amount` (numeric) - Total cost (hourly_rate × total_hours)
  - `status` (text) - Booking status: 'confirmed', 'cancelled', 'completed'
  - `notes` (text) - Optional notes about the booking
  - `invoice_id` (uuid, foreign key, nullable) - Links to invoice when invoiced
  - `created_at` (timestamptz) - When booking was created
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  
  - Enable Row Level Security on all tables
  - Add policies for anonymous access (matching existing pattern)
  
  ## Indexes
  
  - Index on space_id for quick room availability checks
  - Index on tenant_id for tenant booking history
  - Index on booking_date for calendar views
  - Composite index on (space_id, booking_date) for availability queries
*/

-- Create meeting room bookings table
CREATE TABLE IF NOT EXISTS meeting_room_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid REFERENCES office_spaces(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  hourly_rate numeric(10, 2) NOT NULL DEFAULT 0,
  total_hours numeric(5, 2) NOT NULL DEFAULT 0,
  total_amount numeric(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  notes text DEFAULT '',
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_space_id ON meeting_room_bookings(space_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON meeting_room_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON meeting_room_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_space_date ON meeting_room_bookings(space_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON meeting_room_bookings(status);

-- Enable Row Level Security
ALTER TABLE meeting_room_bookings ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (matching existing pattern)
CREATE POLICY "Allow anonymous select on meeting_room_bookings"
  ON meeting_room_bookings FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert on meeting_room_bookings"
  ON meeting_room_bookings FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update on meeting_room_bookings"
  ON meeting_room_bookings FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete on meeting_room_bookings"
  ON meeting_room_bookings FOR DELETE
  TO anon
  USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_meeting_room_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meeting_room_bookings_timestamp
  BEFORE UPDATE ON meeting_room_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_room_bookings_updated_at();