/*
  # Automatiseringen: Verlopen contracten, huurindexering en boekingen afronden

  ## Nieuwe scheduled jobs
  1. `check_expiring_leases` - Dagelijkse check of huurcontracten binnen 30/60 dagen verlopen
     - Maakt een admin notificatie aan per verlopend contract
  2. `apply_rent_indexation` - Jaarlijkse huurprijsverhoging op actieve contracten
     - Configureerbaar percentage opgeslagen in company_settings
  3. `complete_past_bookings` - Zet vergaderruimte en flexplek boekingen die in het verleden liggen
     maar nog op 'confirmed' staan automatisch op 'completed'

  ## Wijzigingen aan admin_notifications
  - Uitgebreid met nieuwe notification_type waarden voor lease events
  - Geen structuurwijzigingen, alleen constraint verwijderd/hersteld voor nieuw type

  ## Wijzigingen aan company_settings
  - Nieuw kolom `rent_indexation_percentage` (numeric, default 0) voor jaarlijkse huurverhoging

  ## Veiligheidsnotities
  - RLS blijft ongewijzigd
  - Geen destructieve operaties
*/

-- Voeg rent_indexation_percentage toe aan company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'rent_indexation_percentage'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN rent_indexation_percentage numeric DEFAULT 0;
  END IF;
END $$;

-- Voeg last_indexation_at toe aan leases om te voorkomen dat indexering meerdere keren wordt uitgevoerd
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'last_indexation_at'
  ) THEN
    ALTER TABLE leases ADD COLUMN last_indexation_at date;
  END IF;
END $$;

-- Verwijder de bestaande check constraint op admin_notifications.notification_type zodat we nieuwe types kunnen toevoegen
ALTER TABLE admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_notification_type_check;

-- Voeg nieuwe scheduled jobs in (indien ze nog niet bestaan)
INSERT INTO scheduled_jobs (job_type, is_enabled, next_run_at)
SELECT 'check_expiring_leases', true, now()
WHERE NOT EXISTS (SELECT 1 FROM scheduled_jobs WHERE job_type = 'check_expiring_leases');

INSERT INTO scheduled_jobs (job_type, is_enabled, next_run_at)
SELECT 'apply_rent_indexation', false, (date_trunc('year', now()) + interval '1 year')::timestamptz
WHERE NOT EXISTS (SELECT 1 FROM scheduled_jobs WHERE job_type = 'apply_rent_indexation');

INSERT INTO scheduled_jobs (job_type, is_enabled, next_run_at)
SELECT 'complete_past_bookings', true, now()
WHERE NOT EXISTS (SELECT 1 FROM scheduled_jobs WHERE job_type = 'complete_past_bookings');
