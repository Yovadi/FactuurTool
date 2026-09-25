-- Per-customer VAT rate. 0% invoices keep the agreed (VAT-inclusive) price as the total.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 21;

ALTER TABLE external_customers
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 21;

COMMENT ON COLUMN tenants.vat_rate IS 'VAT percentage on this customer''s invoices. Use 0 when VAT does not apply; the listed inclusive price stays the invoice total.';
COMMENT ON COLUMN external_customers.vat_rate IS 'VAT percentage on this customer''s invoices. Use 0 when VAT does not apply; the listed inclusive price stays the invoice total.';

-- Catalog prices for rent and meeting rooms are the amount the customer pays.
UPDATE space_type_rates
SET vat_inclusive = true
WHERE vat_inclusive = false;

-- Existing contracts follow the same rule: the stored rent is the amount due.
UPDATE leases
SET vat_inclusive = true
WHERE vat_inclusive = false;
