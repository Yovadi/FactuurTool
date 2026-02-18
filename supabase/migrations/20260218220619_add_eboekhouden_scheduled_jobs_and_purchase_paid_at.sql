/*
  # e-Boekhouden automatische geplande taken en inkoopfactuur betaaldatum

  ## Wijzigingen

  ### 1. Nieuwe scheduled jobs
  - `eboekhouden_payment_status_check` - Controleert dagelijks de betaalstatus van verkoop- én inkoopfacturen in e-Boekhouden
  - `eboekhouden_sync_verification` - Verifieert dagelijks of gesynchroniseerde facturen/creditnota's nog bestaan in e-Boekhouden
  - `eboekhouden_relation_verification` - Verifieert dagelijks of gesynchroniseerde relaties (huurders/externe klanten) nog bestaan in e-Boekhouden

  ### 2. Inkoopfacturen tabel
  - Voegt `paid_at` kolom toe aan `purchase_invoices` voor het opslaan van de betaaldatum

  ### Notities
  - Jobs starten direct bij aanmaken (next_run_at = nu) zodat ze bij de eerstvolgende app-sessie worden uitgevoerd
  - Jobs worden herhaald met een interval van 24 uur
  - Jobs worden alleen uitgevoerd als `eboekhouden_connected = true` in company_settings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM scheduled_jobs WHERE job_type = 'eboekhouden_payment_status_check'
  ) THEN
    INSERT INTO scheduled_jobs (job_type, is_enabled, next_run_at)
    VALUES ('eboekhouden_payment_status_check', true, now());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM scheduled_jobs WHERE job_type = 'eboekhouden_sync_verification'
  ) THEN
    INSERT INTO scheduled_jobs (job_type, is_enabled, next_run_at)
    VALUES ('eboekhouden_sync_verification', true, now());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM scheduled_jobs WHERE job_type = 'eboekhouden_relation_verification'
  ) THEN
    INSERT INTO scheduled_jobs (job_type, is_enabled, next_run_at)
    VALUES ('eboekhouden_relation_verification', true, now());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_invoices' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE purchase_invoices ADD COLUMN paid_at timestamptz;
  END IF;
END $$;
