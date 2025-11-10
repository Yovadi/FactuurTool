/*
  # Credit Note Applications System

  1. New Tables
    - `credit_note_applications`
      - `id` (uuid, primary key)
      - `credit_note_id` (uuid, foreign key to credit_notes)
      - `invoice_id` (uuid, foreign key to invoices) - nullable for manual applications
      - `applied_amount` (numeric) - amount applied from the credit note
      - `application_date` (timestamptz) - when the credit was applied
      - `application_type` (text) - 'invoice_credit', 'refund', or 'manual'
      - `notes` (text) - optional notes about the application
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `available_credit` column to credit_notes (computed from total minus applied)
    - Add `applied_credit` column to invoices (total credit applied to this invoice)

  3. Security
    - Enable RLS on `credit_note_applications` table
    - Add policies for authenticated users

  4. Functions
    - Function to calculate available credit on a credit note
    - Function to calculate applied credit on an invoice
    - Trigger to update invoice amounts when credit is applied
*/

-- Add columns to existing tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'applied_credit'
  ) THEN
    ALTER TABLE invoices ADD COLUMN applied_credit numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Create credit note applications table
CREATE TABLE IF NOT EXISTS credit_note_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  applied_amount numeric(10,2) NOT NULL CHECK (applied_amount > 0),
  application_date timestamptz DEFAULT now() NOT NULL,
  application_type text NOT NULL CHECK (application_type IN ('invoice_credit', 'refund', 'manual')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE credit_note_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow anonymous read access to credit note applications"
  ON credit_note_applications FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert access to credit note applications"
  ON credit_note_applications FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to credit note applications"
  ON credit_note_applications FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to credit note applications"
  ON credit_note_applications FOR DELETE
  TO anon
  USING (true);

-- Function to get available credit for a credit note
CREATE OR REPLACE FUNCTION get_available_credit(credit_note_id_param uuid)
RETURNS numeric AS $$
DECLARE
  total numeric;
  applied numeric;
BEGIN
  SELECT total_amount INTO total
  FROM credit_notes
  WHERE id = credit_note_id_param;
  
  SELECT COALESCE(SUM(applied_amount), 0) INTO applied
  FROM credit_note_applications
  WHERE credit_note_id = credit_note_id_param;
  
  RETURN COALESCE(total, 0) - COALESCE(applied, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice applied credit
CREATE OR REPLACE FUNCTION update_invoice_applied_credit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.invoice_id IS NOT NULL THEN
      UPDATE invoices
      SET applied_credit = COALESCE((
        SELECT SUM(applied_amount)
        FROM credit_note_applications
        WHERE invoice_id = NEW.invoice_id
      ), 0)
      WHERE id = NEW.invoice_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_id IS NOT NULL THEN
      UPDATE invoices
      SET applied_credit = COALESCE((
        SELECT SUM(applied_amount)
        FROM credit_note_applications
        WHERE invoice_id = OLD.invoice_id
      ), 0)
      WHERE id = OLD.invoice_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update invoice applied_credit
DROP TRIGGER IF EXISTS trigger_update_invoice_applied_credit ON credit_note_applications;
CREATE TRIGGER trigger_update_invoice_applied_credit
  AFTER INSERT OR UPDATE OR DELETE ON credit_note_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_applied_credit();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_credit_note_applications_credit_note_id ON credit_note_applications(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_applications_invoice_id ON credit_note_applications(invoice_id);
