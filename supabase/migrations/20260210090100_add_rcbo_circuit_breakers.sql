/*
  # Aardlekautomaten (RCBO) Systeem

  ## Nieuwe Tabel
  - `rcbo_circuit_breakers`
    - `id` (uuid, primary key)
    - `rcbo_number` (integer) - Nummer van de aardlekautomaat (1-50)
    - `tenant_id` (uuid, foreign key) - Gekoppelde huurder
    - `description` (text) - Omschrijving/notities
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
  
  ## Beschrijving
  Dit systeem voegt ondersteuning toe voor aardlekautomaten (RCBOs) - dit zijn combinatieautomaten
  met zowel aardlekbeveiliging als overbelastingsbeveiliging in één apparaat. In tegenstelling tot
  de bestaande ALA systemen (aardlek met losse automaten), hebben RCBOs geen aparte groepen nodig.
  
  Elke RCBO wordt gekoppeld aan een huurder via een kleur-gecodeerd systeem voor eenvoudige visuele
  identificatie in de meterkast.

  ## Beveiliging
  - RLS is ingeschakeld
  - Iedereen (anon) kan RCBO records lezen, aanmaken, bijwerken en verwijderen
*/

CREATE TABLE IF NOT EXISTS rcbo_circuit_breakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rcbo_number integer NOT NULL CHECK (rcbo_number >= 1 AND rcbo_number <= 50),
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rcbo_circuit_breakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to rcbo_circuit_breakers"
  ON rcbo_circuit_breakers FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to rcbo_circuit_breakers"
  ON rcbo_circuit_breakers FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to rcbo_circuit_breakers"
  ON rcbo_circuit_breakers FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to rcbo_circuit_breakers"
  ON rcbo_circuit_breakers FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_rcbo_circuit_breakers_rcbo_number 
  ON rcbo_circuit_breakers(rcbo_number);

CREATE INDEX IF NOT EXISTS idx_rcbo_circuit_breakers_tenant_id 
  ON rcbo_circuit_breakers(tenant_id);