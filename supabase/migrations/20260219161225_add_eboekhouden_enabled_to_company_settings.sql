/*
  # Voeg eboekhouden_enabled veld toe aan company_settings

  ## Wijziging
  - Nieuw veld `eboekhouden_enabled` (boolean, default false) toegevoegd aan company_settings
  - Dit veld bepaalt of de e-Boekhouden integratie zichtbaar en actief is in de applicatie
  - Standaard uitgeschakeld zodat de koppeling niet zichtbaar is voor gebruikers die e-Boekhouden niet gebruiken

  ## Beveiliging
  - Geen wijzigingen in RLS policies (bestaande policies blijven van kracht)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'eboekhouden_enabled'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN eboekhouden_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;
