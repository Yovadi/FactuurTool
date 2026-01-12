/*
  # Add Invoice Duplicate Prevention

  1. Purpose
    - Prevent duplicate invoices for the same lease and month
    - Prevent duplicate meeting room invoices for the same customer and month
    - Ensure data integrity at database level

  2. Changes
    - Add unique constraint for lease invoices (lease_id + invoice_month)
    - Add unique constraint for tenant meeting room invoices (tenant_id + invoice_month where lease_id IS NULL)
    - Add unique constraint for external customer invoices (external_customer_id + invoice_month where lease_id IS NULL)

  3. Security
    - Database-level enforcement prevents accidental duplicates
    - Works across all application layers
*/

-- Unique constraint for lease invoices
-- One invoice per lease per month
CREATE UNIQUE INDEX IF NOT EXISTS invoices_lease_month_unique 
  ON invoices(lease_id, invoice_month) 
  WHERE lease_id IS NOT NULL;

-- Unique constraint for tenant meeting room/manual invoices
-- One non-lease invoice per tenant per month
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_month_unique 
  ON invoices(tenant_id, invoice_month) 
  WHERE lease_id IS NULL AND tenant_id IS NOT NULL;

-- Unique constraint for external customer invoices
-- One invoice per external customer per month
CREATE UNIQUE INDEX IF NOT EXISTS invoices_external_customer_month_unique 
  ON invoices(external_customer_id, invoice_month) 
  WHERE lease_id IS NULL AND external_customer_id IS NOT NULL;