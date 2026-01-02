/*
  # Add Meter Groups Support

  1. New Table
    - `meter_groups`
      - `id` (uuid, primary key)
      - `group_number` (integer) - Meter group number (K1, K2, etc.)
      - `location_type` (text) - Type: 'kantoor', 'bedrijfshal', 'eigen_gebruik'
      - `location_number` (integer) - Office (1-8) or hall (1-4) number
      - `description` (text) - Optional description
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on meter_groups table
    - Add policy for anonymous access (consistent with other tables)
  
  3. Important Notes
    - Group numbers are flexible (not limited, can add as many as needed)
    - Supports same location types as patch ports
    - Multiple groups can be assigned to same location
    - Old meter_cabinet_info field remains for general meter cabinet notes
*/

CREATE TABLE IF NOT EXISTS meter_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_number integer NOT NULL,
  location_type text CHECK (location_type IN ('kantoor', 'bedrijfshal', 'eigen_gebruik')),
  location_number integer,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(group_number)
);

ALTER TABLE meter_groups ADD CONSTRAINT valid_meter_location_number CHECK (
  (location_type = 'kantoor' AND location_number BETWEEN 1 AND 8) OR
  (location_type = 'bedrijfshal' AND location_number BETWEEN 1 AND 4) OR
  (location_type = 'eigen_gebruik' AND location_number IS NULL) OR
  (location_type IS NULL)
);

ALTER TABLE meter_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to meter_groups"
  ON meter_groups
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_meter_groups_number ON meter_groups(group_number);
CREATE INDEX IF NOT EXISTS idx_meter_groups_location ON meter_groups(location_type, location_number);
