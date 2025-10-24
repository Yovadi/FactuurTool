/*
  # Voeg bedrijfsnaam toe aan tenants

  1. Wijzigingen
    - Voeg `company_name` kolom toe aan `tenants` tabel
    - Dit veld wordt gebruikt als primaire identificatie voor huurders
    - Het `name` veld blijft bestaan voor contactpersoon naam
  
  2. Details
    - `company_name` (text, niet nullable, standaard waarde voor bestaande records)
*/

-- Voeg company_name kolom toe aan tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE tenants ADD COLUMN company_name text NOT NULL DEFAULT '';
  END IF;
END $$;