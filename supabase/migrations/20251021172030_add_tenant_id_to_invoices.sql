/*
  # Add tenant_id to invoices table

  1. Changes
    - Add `tenant_id` column to `invoices` table (nullable)
    - Add foreign key constraint to `tenants` table
    - This allows invoices to reference tenants directly for standalone invoices
  
  2. Notes
    - For lease-based invoices, tenant info comes from the lease
    - For standalone invoices, tenant_id is used directly
    - One of lease_id or tenant_id should be present, but not enforced at DB level for flexibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  END IF;
END $$;