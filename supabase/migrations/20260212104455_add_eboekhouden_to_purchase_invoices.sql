/*
  # Add e-Boekhouden integration fields to purchase invoices

  1. Modified Tables
    - `purchase_invoices`
      - `eboekhouden_factuur_id` (integer, nullable) - e-Boekhouden mutation/invoice ID
      - `eboekhouden_synced_at` (timestamptz, nullable) - timestamp of last sync
      - `eboekhouden_relatie_id` (integer, nullable) - supplier relation ID in e-Boekhouden

  2. Notes
    - Purchase invoices are synced as mutations (mutaties) in e-Boekhouden
    - Suppliers are synced as relations (relaties) in e-Boekhouden
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_invoices' AND column_name = 'eboekhouden_factuur_id'
  ) THEN
    ALTER TABLE purchase_invoices ADD COLUMN eboekhouden_factuur_id integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_invoices' AND column_name = 'eboekhouden_synced_at'
  ) THEN
    ALTER TABLE purchase_invoices ADD COLUMN eboekhouden_synced_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_invoices' AND column_name = 'eboekhouden_relatie_id'
  ) THEN
    ALTER TABLE purchase_invoices ADD COLUMN eboekhouden_relatie_id integer;
  END IF;
END $$;
