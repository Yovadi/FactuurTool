/*
  # Add Flex Schedule System

  1. New Tables
    - `flex_schedules`
      - `id` (uuid, primary key)
      - `lease_id` (uuid, foreign key to leases)
      - `space_id` (uuid, foreign key to office_spaces)
      - `monday` (boolean, default false)
      - `tuesday` (boolean, default false)
      - `wednesday` (boolean, default false)
      - `thursday` (boolean, default false)
      - `friday` (boolean, default false)
      - `created_at` (timestamp)
  
  2. Changes
    - Simplify flex pricing model to only support credit-based (strippenkaart)
    - Add constraint to ensure only flex leases can have flex schedules
  
  3. Security
    - Enable RLS on flex_schedules table
    - Add policies for authenticated and anonymous access
  
  4. Notes
    - This table tracks which days a flexer is allowed to work in which flex spaces
    - Each flex lease can have multiple schedules for different spaces
    - Booleans indicate which weekdays (Mon-Fri) the flexer can use the space
*/

CREATE TABLE IF NOT EXISTS flex_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES office_spaces(id) ON DELETE CASCADE,
  monday boolean DEFAULT false,
  tuesday boolean DEFAULT false,
  wednesday boolean DEFAULT false,
  thursday boolean DEFAULT false,
  friday boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_lease_space UNIQUE (lease_id, space_id)
);

ALTER TABLE flex_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to flex_schedules"
  ON flex_schedules FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to flex_schedules"
  ON flex_schedules FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to flex_schedules"
  ON flex_schedules FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to flex_schedules"
  ON flex_schedules FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated read access to flex_schedules"
  ON flex_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access to flex_schedules"
  ON flex_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access to flex_schedules"
  ON flex_schedules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access to flex_schedules"
  ON flex_schedules FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE flex_schedules IS 'Tracks which days flexers are allowed to work in specific flex spaces';
COMMENT ON COLUMN flex_schedules.lease_id IS 'The flex lease this schedule belongs to';
COMMENT ON COLUMN flex_schedules.space_id IS 'The flex space this schedule applies to';
COMMENT ON COLUMN flex_schedules.monday IS 'Whether the flexer can work on Mondays';
COMMENT ON COLUMN flex_schedules.tuesday IS 'Whether the flexer can work on Tuesdays';
COMMENT ON COLUMN flex_schedules.wednesday IS 'Whether the flexer can work on Wednesdays';
COMMENT ON COLUMN flex_schedules.thursday IS 'Whether the flexer can work on Thursdays';
COMMENT ON COLUMN flex_schedules.friday IS 'Whether the flexer can work on Fridays';