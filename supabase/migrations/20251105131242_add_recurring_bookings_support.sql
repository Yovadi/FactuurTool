/*
  # Add Recurring Bookings Support

  1. New Tables
    - `recurring_booking_patterns`
      - `id` (uuid, primary key)
      - `space_id` (uuid, reference to office_spaces) - Which meeting room
      - `tenant_id` (uuid, reference to tenants) - Which tenant
      - `start_time` (time) - Daily start time (e.g., 09:00)
      - `end_time` (time) - Daily end time (e.g., 11:00)
      - `recurrence_type` (text) - 'daily', 'weekly', 'monthly'
      - `recurrence_days` (text[]) - For weekly: ['monday', 'wednesday', 'friday']
      - `recurrence_date` (integer) - For monthly: day of month (1-31)
      - `start_date` (date) - When pattern starts
      - `end_date` (date, nullable) - When pattern ends (null = indefinite)
      - `is_active` (boolean) - Can be paused/resumed
      - `notes` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes to `meeting_room_bookings`
    - Add `recurring_pattern_id` (uuid, nullable) - Links to parent pattern
    - Add `is_exception` (boolean) - True if booking was modified from pattern

  3. Security
    - Enable RLS on `recurring_booking_patterns` table
    - Add policy for anonymous users to read and manage patterns

  4. Notes
    - Individual bookings are still created in `meeting_room_bookings`
    - Recurring pattern is just a template/generator
    - Users can modify individual bookings without affecting the pattern
    - Deleting a pattern can optionally delete all future bookings
*/

-- Create recurring_booking_patterns table
CREATE TABLE IF NOT EXISTS recurring_booking_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES office_spaces(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  recurrence_type text NOT NULL CHECK (recurrence_type IN ('daily', 'weekly', 'monthly')),
  recurrence_days text[] DEFAULT '{}',
  recurrence_date integer CHECK (recurrence_date >= 1 AND recurrence_date <= 31),
  start_date date NOT NULL,
  end_date date,
  is_active boolean DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add columns to meeting_room_bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_room_bookings' AND column_name = 'recurring_pattern_id'
  ) THEN
    ALTER TABLE meeting_room_bookings ADD COLUMN recurring_pattern_id uuid REFERENCES recurring_booking_patterns(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_room_bookings' AND column_name = 'is_exception'
  ) THEN
    ALTER TABLE meeting_room_bookings ADD COLUMN is_exception boolean DEFAULT false;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE recurring_booking_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recurring_booking_patterns
CREATE POLICY "Allow anonymous read access to recurring patterns"
  ON recurring_booking_patterns FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to recurring patterns"
  ON recurring_booking_patterns FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to recurring patterns"
  ON recurring_booking_patterns FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to recurring patterns"
  ON recurring_booking_patterns FOR DELETE
  TO anon
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_space_tenant ON recurring_booking_patterns(space_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_active ON recurring_booking_patterns(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bookings_recurring_pattern ON meeting_room_bookings(recurring_pattern_id) WHERE recurring_pattern_id IS NOT NULL;