/*
  # Uitbreiding Pand Informatie voor Verhuurder

  Voegt extra velden toe aan company_settings voor technische pand informatie.

  1. Nieuwe Velden
    - `wifi_network_name` (text) - Naam van het WiFi netwerk
    - `wifi_password` (text) - WiFi wachtwoord
    - `patch_points` (text) - Informatie over netwerk patchpunten
    - `meter_cabinet_info` (text) - Informatie over meterkast indeling
    - `building_notes` (text) - Algemene notities over het pand

  2. Notities
    - Deze velden zijn optioneel en kunnen leeg blijven
    - Bestaande data blijft ongewijzigd
*/

-- Voeg pand informatie velden toe aan company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'wifi_network_name'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN wifi_network_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'wifi_password'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN wifi_password text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'patch_points'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN patch_points text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'meter_cabinet_info'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN meter_cabinet_info text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'building_notes'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN building_notes text;
  END IF;
END $$;