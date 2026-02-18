/*
  # Add e-Boekhouden not-found flag to invoices

  ## Summary
  Adds a boolean flag `eboekhouden_not_found` to the `invoices` table so the app
  can mark invoices that were synced but are no longer found (deleted) in e-Boekhouden.

  ## Changes
  - `invoices.eboekhouden_not_found` (boolean, default false) – set to true when a
    verify/re-sync attempt discovers the invoice no longer exists in e-Boekhouden.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'eboekhouden_not_found'
  ) THEN
    ALTER TABLE invoices ADD COLUMN eboekhouden_not_found boolean DEFAULT false;
  END IF;
END $$;
