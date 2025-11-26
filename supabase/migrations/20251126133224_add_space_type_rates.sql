/*
  # Tarieven per Ruimtetype

  1. Nieuwe Tabel
    - `space_type_rates`
      - `id` (uuid, primary key)
      - `space_type` (text) - Type ruimte (bedrijfsruimte, kantoor, etc.)
      - `rate_per_sqm` (numeric) - Prijs per vierkante meter
      - `calculation_method` (text) - Berekeningsmethode (per_sqm, fixed_monthly, hourly)
      - `fixed_rate` (numeric) - Vast tarief (indien applicable)
      - `hourly_rate` (numeric) - Uurtarief (indien applicable)
      - `description` (text) - Beschrijving van het tarief
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Beveiliging
    - RLS inschakelen
    - Policies voor anonymous toegang (lezen en schrijven)
*/

CREATE TABLE IF NOT EXISTS space_type_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_type text NOT NULL UNIQUE,
  rate_per_sqm numeric(10, 2) DEFAULT 0,
  calculation_method text DEFAULT 'per_sqm' CHECK (calculation_method IN ('per_sqm', 'fixed_monthly', 'hourly', 'custom')),
  fixed_rate numeric(10, 2) DEFAULT 0,
  hourly_rate numeric(10, 2) DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS inschakelen
ALTER TABLE space_type_rates ENABLE ROW LEVEL SECURITY;

-- Policies voor anonymous toegang
CREATE POLICY "Allow anonymous read access to space_type_rates"
  ON space_type_rates
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to space_type_rates"
  ON space_type_rates
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to space_type_rates"
  ON space_type_rates
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to space_type_rates"
  ON space_type_rates
  FOR DELETE
  TO anon
  USING (true);

-- Standaard tarieven invoegen
INSERT INTO space_type_rates (space_type, calculation_method, rate_per_sqm, description)
VALUES 
  ('bedrijfsruimte', 'per_sqm', 0, 'Bedrijfsruimte - prijs per m²'),
  ('kantoor', 'per_sqm', 0, 'Kantoorruimte - prijs per m²'),
  ('buitenterrein', 'per_sqm', 0, 'Buitenterrein - prijs per m²'),
  ('diversen', 'fixed_monthly', 0, 'Diversen - vast maandbedrag'),
  ('Meeting Room', 'hourly', 0, 'Vergaderruimte - prijs per uur')
ON CONFLICT (space_type) DO NOTHING;

-- Trigger voor updated_at
CREATE OR REPLACE FUNCTION update_space_type_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER space_type_rates_updated_at
  BEFORE UPDATE ON space_type_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_space_type_rates_updated_at();
