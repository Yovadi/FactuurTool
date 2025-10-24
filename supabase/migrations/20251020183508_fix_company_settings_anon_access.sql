/*
  # Fix Company Settings Access for Anonymous Users

  1. Changes
    - Allow anonymous users to insert company settings
    - Allow anonymous users to update company settings
    - Keep read access for all users
  
  2. Security
    - This is acceptable for a single-tenant application where company settings are global
    - In production, consider adding authentication
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert company settings" ON company_settings;
DROP POLICY IF EXISTS "Authenticated users can update company settings" ON company_settings;

-- Recreate policies allowing anonymous access
CREATE POLICY "Anyone can insert company settings"
  ON company_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update company settings"
  ON company_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);