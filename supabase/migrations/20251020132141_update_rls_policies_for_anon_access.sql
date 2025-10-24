/*
  # Update RLS Policies for Anonymous Access

  ## Changes
  This migration updates the Row Level Security policies to allow anonymous (unauthenticated) access
  to all tables. This is suitable for demo/development purposes.

  ## Security Note
  In production, you should implement proper authentication and restrict access based on user roles.

  ## Modified Policies
  - Drop existing authenticated-only policies
  - Create new policies allowing anonymous access for all operations
*/

-- Drop existing policies for tenants
DROP POLICY IF EXISTS "Authenticated users can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Authenticated users can insert tenants" ON tenants;
DROP POLICY IF EXISTS "Authenticated users can update tenants" ON tenants;
DROP POLICY IF EXISTS "Authenticated users can delete tenants" ON tenants;

-- Create new policies for tenants allowing anon access
CREATE POLICY "Anyone can view tenants"
  ON tenants FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert tenants"
  ON tenants FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update tenants"
  ON tenants FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete tenants"
  ON tenants FOR DELETE
  TO anon, authenticated
  USING (true);

-- Drop existing policies for office_spaces
DROP POLICY IF EXISTS "Authenticated users can view all office spaces" ON office_spaces;
DROP POLICY IF EXISTS "Authenticated users can insert office spaces" ON office_spaces;
DROP POLICY IF EXISTS "Authenticated users can update office spaces" ON office_spaces;
DROP POLICY IF EXISTS "Authenticated users can delete office spaces" ON office_spaces;

-- Create new policies for office_spaces allowing anon access
CREATE POLICY "Anyone can view office spaces"
  ON office_spaces FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert office spaces"
  ON office_spaces FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update office spaces"
  ON office_spaces FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete office spaces"
  ON office_spaces FOR DELETE
  TO anon, authenticated
  USING (true);

-- Drop existing policies for leases
DROP POLICY IF EXISTS "Authenticated users can view all leases" ON leases;
DROP POLICY IF EXISTS "Authenticated users can insert leases" ON leases;
DROP POLICY IF EXISTS "Authenticated users can update leases" ON leases;
DROP POLICY IF EXISTS "Authenticated users can delete leases" ON leases;

-- Create new policies for leases allowing anon access
CREATE POLICY "Anyone can view leases"
  ON leases FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert leases"
  ON leases FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update leases"
  ON leases FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete leases"
  ON leases FOR DELETE
  TO anon, authenticated
  USING (true);

-- Drop existing policies for invoices
DROP POLICY IF EXISTS "Authenticated users can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON invoices;

-- Create new policies for invoices allowing anon access
CREATE POLICY "Anyone can view invoices"
  ON invoices FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert invoices"
  ON invoices FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update invoices"
  ON invoices FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete invoices"
  ON invoices FOR DELETE
  TO anon, authenticated
  USING (true);

-- Drop existing policies for invoice_line_items
DROP POLICY IF EXISTS "Authenticated users can view all invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Authenticated users can insert invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Authenticated users can update invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Authenticated users can delete invoice line items" ON invoice_line_items;

-- Create new policies for invoice_line_items allowing anon access
CREATE POLICY "Anyone can view invoice line items"
  ON invoice_line_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert invoice line items"
  ON invoice_line_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update invoice line items"
  ON invoice_line_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete invoice line items"
  ON invoice_line_items FOR DELETE
  TO anon, authenticated
  USING (true);
