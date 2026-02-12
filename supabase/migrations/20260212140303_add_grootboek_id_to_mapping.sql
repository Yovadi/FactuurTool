/*
  # Add grootboek_id to grootboek mapping

  1. Modified Tables
    - `eboekhouden_grootboek_mapping`
      - Added `grootboek_id` (integer, nullable) - the actual internal e-Boekhouden ledger account ID
  
  2. Notes
    - The e-Boekhouden API requires the internal numeric ID (not the code) when creating invoices
    - This column stores that ID so invoices can be synced correctly
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'eboekhouden_grootboek_mapping' AND column_name = 'grootboek_id'
  ) THEN
    ALTER TABLE eboekhouden_grootboek_mapping ADD COLUMN grootboek_id integer;
  END IF;
END $$;
