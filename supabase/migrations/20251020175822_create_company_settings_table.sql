/*
  # Maak company_settings tabel voor factureerder gegevens

  1. Nieuwe Tabel
    - `company_settings`
      - `id` (uuid, primary key)
      - `company_name` (text, bedrijfsnaam van de verhuurder)
      - `address` (text, adres van de verhuurder)
      - `postal_code` (text, postcode)
      - `city` (text, stad)
      - `country` (text, land)
      - `phone` (text, telefoonnummer)
      - `email` (text, email adres)
      - `vat_number` (text, BTW nummer)
      - `kvk_number` (text, KVK nummer)
      - `bank_account` (text, bankrekeningnummer/IBAN)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Beveiliging
    - Enable RLS op `company_settings` tabel
    - Iedereen kan de instellingen lezen (voor facturen)
    - Alleen authenticated users kunnen de instellingen wijzigen
*/

CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT '',
  address text DEFAULT '',
  postal_code text DEFAULT '',
  city text DEFAULT '',
  country text DEFAULT 'Nederland',
  phone text DEFAULT '',
  email text DEFAULT '',
  vat_number text DEFAULT '',
  kvk_number text DEFAULT '',
  bank_account text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read company settings"
  ON company_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert company settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default record if none exists
INSERT INTO company_settings (company_name)
SELECT 'Mijn Bedrijf'
WHERE NOT EXISTS (SELECT 1 FROM company_settings LIMIT 1);