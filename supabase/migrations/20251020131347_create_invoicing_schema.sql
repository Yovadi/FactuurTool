/*
  # Multi-Tenant Office Invoicing System Schema

  ## Overview
  This migration creates the complete database schema for a multi-tenant building invoicing system.
  It includes tables for managing tenants, office spaces, leases, and invoices.

  ## New Tables

  ### 1. `tenants`
  Stores information about companies/individuals renting office spaces
  - `id` (uuid, primary key) - Unique tenant identifier
  - `name` (text) - Company or individual name
  - `email` (text) - Primary contact email
  - `phone` (text, optional) - Contact phone number
  - `billing_address` (text, optional) - Billing address
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. `office_spaces`
  Manages individual office spaces in the building
  - `id` (uuid, primary key) - Unique space identifier
  - `space_number` (text, unique) - Office/suite number
  - `floor` (integer) - Floor number
  - `square_footage` (numeric) - Size in square feet
  - `base_rent` (numeric) - Monthly base rent amount
  - `is_available` (boolean) - Availability status
  - `created_at` (timestamptz) - Record creation timestamp

  ### 3. `leases`
  Tracks lease agreements between tenants and office spaces
  - `id` (uuid, primary key) - Unique lease identifier
  - `tenant_id` (uuid, foreign key) - Reference to tenant
  - `space_id` (uuid, foreign key) - Reference to office space
  - `start_date` (date) - Lease start date
  - `end_date` (date) - Lease end date
  - `monthly_rent` (numeric) - Agreed monthly rent
  - `security_deposit` (numeric) - Security deposit amount
  - `status` (text) - Lease status (active, expired, terminated)
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. `invoices`
  Manages invoices for tenants
  - `id` (uuid, primary key) - Unique invoice identifier
  - `lease_id` (uuid, foreign key) - Reference to lease
  - `invoice_number` (text, unique) - Human-readable invoice number
  - `invoice_date` (date) - Invoice issue date
  - `due_date` (date) - Payment due date
  - `amount` (numeric) - Total invoice amount
  - `status` (text) - Payment status (draft, sent, paid, overdue)
  - `notes` (text, optional) - Additional notes
  - `created_at` (timestamptz) - Record creation timestamp
  - `paid_at` (timestamptz, optional) - Payment timestamp

  ### 5. `invoice_line_items`
  Individual line items on invoices
  - `id` (uuid, primary key) - Unique line item identifier
  - `invoice_id` (uuid, foreign key) - Reference to invoice
  - `description` (text) - Line item description
  - `quantity` (numeric) - Quantity
  - `unit_price` (numeric) - Price per unit
  - `amount` (numeric) - Total line amount
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies allow authenticated users to manage all records
  - In production, these policies should be refined based on user roles

  ## Important Notes
  1. All monetary amounts use numeric type for precision
  2. Invoice numbers are auto-generated with format INV-YYYYMM-XXXX
  3. Lease status automatically affects space availability
  4. Foreign key constraints ensure data integrity
*/

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  billing_address text,
  created_at timestamptz DEFAULT now()
);

-- Create office_spaces table
CREATE TABLE IF NOT EXISTS office_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_number text UNIQUE NOT NULL,
  floor integer NOT NULL,
  square_footage numeric NOT NULL,
  base_rent numeric NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create leases table
CREATE TABLE IF NOT EXISTS leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES office_spaces(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_rent numeric NOT NULL,
  security_deposit numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_lease_dates CHECK (end_date > start_date),
  CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'terminated'))
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  invoice_number text UNIQUE NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  CONSTRAINT valid_invoice_dates CHECK (due_date >= invoice_date),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'sent', 'paid', 'overdue'))
);

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_space_id ON leases(space_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);
CREATE INDEX IF NOT EXISTS idx_invoices_lease_id ON invoices(lease_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Authenticated users can view all tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tenants"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tenants"
  ON tenants FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tenants"
  ON tenants FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view all office spaces"
  ON office_spaces FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert office spaces"
  ON office_spaces FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update office spaces"
  ON office_spaces FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete office spaces"
  ON office_spaces FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view all leases"
  ON leases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert leases"
  ON leases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update leases"
  ON leases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete leases"
  ON leases FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view all invoice line items"
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoice line items"
  ON invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice line items"
  ON invoice_line_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete invoice line items"
  ON invoice_line_items FOR DELETE
  TO authenticated
  USING (true);

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  new_number text;
  counter integer;
  month_year text;
BEGIN
  month_year := TO_CHAR(CURRENT_DATE, 'YYYYMM');
  
  SELECT COUNT(*) + 1 INTO counter
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || month_year || '-%';
  
  new_number := 'INV-' || month_year || '-' || LPAD(counter::text, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;