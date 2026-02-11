/*
  # Inkoopfacturen (Purchase Invoices) & AI Configuration

  1. New Tables
    - `purchase_invoices`
      - `id` (uuid, primary key)
      - `invoice_number` (text) - Invoice number from the supplier
      - `supplier_name` (text) - Name of the supplier/vendor
      - `supplier_address` (text) - Supplier address
      - `supplier_postal_code` (text) - Supplier postal code
      - `supplier_city` (text) - Supplier city
      - `supplier_country` (text) - Supplier country
      - `supplier_vat_number` (text) - Supplier VAT number
      - `supplier_kvk_number` (text) - Supplier KVK number
      - `supplier_iban` (text) - Supplier bank account
      - `invoice_date` (date) - Date on the invoice
      - `due_date` (date) - Payment due date
      - `subtotal` (numeric) - Amount before VAT
      - `vat_amount` (numeric) - VAT amount
      - `vat_rate` (numeric) - VAT percentage
      - `total_amount` (numeric) - Total amount including VAT
      - `status` (text) - Status: draft, pending, paid, overdue
      - `category` (text) - Expense category
      - `notes` (text) - Optional notes
      - `original_file_url` (text) - Reference to uploaded file
      - `original_file_name` (text) - Original filename
      - `ai_extracted` (boolean) - Whether data was extracted by AI
      - `ai_confidence` (numeric) - AI confidence score 0-100
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `purchase_invoice_line_items`
      - `id` (uuid, primary key)
      - `purchase_invoice_id` (uuid, foreign key)
      - `description` (text) - Item description
      - `quantity` (numeric) - Quantity
      - `unit_price` (numeric) - Price per unit
      - `amount` (numeric) - Total line amount
      - `vat_rate` (numeric) - VAT rate for this line
      - `created_at` (timestamptz)

  2. Modified Tables
    - `company_settings`
      - Added `openai_api_key` (text) - For AI invoice parsing

  3. Security
    - Enable RLS on both new tables
    - Add policies for anon access (matching existing pattern)
*/

-- Add OpenAI API key to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'openai_api_key'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN openai_api_key text DEFAULT '';
  END IF;
END $$;

-- Create purchase_invoices table
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL DEFAULT '',
  supplier_name text NOT NULL DEFAULT '',
  supplier_address text DEFAULT '',
  supplier_postal_code text DEFAULT '',
  supplier_city text DEFAULT '',
  supplier_country text DEFAULT 'Nederland',
  supplier_vat_number text DEFAULT '',
  supplier_kvk_number text DEFAULT '',
  supplier_iban text DEFAULT '',
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  vat_amount numeric(10,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 21,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'paid', 'overdue')),
  category text DEFAULT '',
  notes text DEFAULT '',
  original_file_name text DEFAULT '',
  ai_extracted boolean DEFAULT false,
  ai_confidence numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on purchase_invoices"
  ON purchase_invoices FOR SELECT
  TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Allow anon insert on purchase_invoices"
  ON purchase_invoices FOR INSERT
  TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Allow anon update on purchase_invoices"
  ON purchase_invoices FOR UPDATE
  TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Allow anon delete on purchase_invoices"
  ON purchase_invoices FOR DELETE
  TO anon
  USING (auth.uid() IS NULL);

-- Create purchase_invoice_line_items table
CREATE TABLE IF NOT EXISTS purchase_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id uuid NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) DEFAULT 21,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select on purchase_invoice_line_items"
  ON purchase_invoice_line_items FOR SELECT
  TO anon
  USING (auth.uid() IS NULL);

CREATE POLICY "Allow anon insert on purchase_invoice_line_items"
  ON purchase_invoice_line_items FOR INSERT
  TO anon
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Allow anon update on purchase_invoice_line_items"
  ON purchase_invoice_line_items FOR UPDATE
  TO anon
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

CREATE POLICY "Allow anon delete on purchase_invoice_line_items"
  ON purchase_invoice_line_items FOR DELETE
  TO anon
  USING (auth.uid() IS NULL);
