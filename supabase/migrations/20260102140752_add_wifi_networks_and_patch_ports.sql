/*
  # Add WiFi Networks and Patch Ports Support

  1. New Tables
    - `wifi_networks`
      - `id` (uuid, primary key)
      - `network_name` (text) - Name of the WiFi network
      - `password` (text) - WiFi password
      - `network_number` (integer) - Network slot number (1-9)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `patch_ports`
      - `id` (uuid, primary key)
      - `switch_number` (integer) - Switch number (1 or 2)
      - `port_number` (integer) - Port number (1-24)
      - `location_description` (text) - Where this port is located
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on both tables
    - Add policies for anonymous access (consistent with company_settings)
  
  3. Important Notes
    - WiFi networks support up to 9 networks
    - Each switch supports 24 ports
    - Tables use anonymous access for ease of use in single-tenant app
*/

CREATE TABLE IF NOT EXISTS wifi_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_name text DEFAULT '',
  password text DEFAULT '',
  network_number integer NOT NULL CHECK (network_number >= 1 AND network_number <= 9),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(network_number)
);

CREATE TABLE IF NOT EXISTS patch_ports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  switch_number integer NOT NULL CHECK (switch_number IN (1, 2)),
  port_number integer NOT NULL CHECK (port_number >= 1 AND port_number <= 24),
  location_description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(switch_number, port_number)
);

ALTER TABLE wifi_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE patch_ports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to wifi_networks"
  ON wifi_networks
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous access to patch_ports"
  ON patch_ports
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wifi_networks_number ON wifi_networks(network_number);
CREATE INDEX IF NOT EXISTS idx_patch_ports_switch_port ON patch_ports(switch_number, port_number);
