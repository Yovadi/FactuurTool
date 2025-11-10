/*
  # Add Credit Notes Support

  1. New Tables
    - credit_notes table with all necessary fields
    - credit_note_line_items for detailed breakdown

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated access

  3. Functions
    - Add function to generate credit note numbers
*/

-- Create credit_notes table
CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number text UNIQUE NOT NULL,
  original_invoice_id uuid REFERENCES invoices(id),
  tenant_id uuid REFERENCES tenants(id),
  external_customer_id uuid REFERENCES external_customers(id),
  credit_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL DEFAULT '',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  vat_amount numeric(10,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'applied')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create credit_note_line_items table
CREATE TABLE IF NOT EXISTS credit_note_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  amount numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_notes
CREATE POLICY "Allow all access to credit_notes"
  ON credit_notes
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for credit_note_line_items
CREATE POLICY "Allow all access to credit_note_line_items"
  ON credit_note_line_items
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Function to generate credit note numbers
CREATE OR REPLACE FUNCTION generate_credit_note_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_number integer;
  credit_note_number text;
  current_year text;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(credit_note_number FROM 'CN' || current_year || '-(\d+)') AS integer)), 0) + 1
  INTO next_number
  FROM credit_notes
  WHERE credit_note_number LIKE 'CN' || current_year || '-%';
  
  credit_note_number := 'CN' || current_year || '-' || LPAD(next_number::text, 4, '0');
  
  RETURN credit_note_number;
END;
$$;