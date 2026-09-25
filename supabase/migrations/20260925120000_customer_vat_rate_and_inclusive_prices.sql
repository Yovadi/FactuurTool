-- Per-customer VAT rate. 0 means the invoice shows no VAT.
-- The exclusive catalog price is then grossed up (15 + 21% = 18.15) so the customer pays the same total.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 21;

ALTER TABLE external_customers
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 21;

COMMENT ON COLUMN tenants.vat_rate IS 'VAT percentage printed on this customer''s invoices. 0 embeds the normal 21% in the price instead of showing it as VAT.';
COMMENT ON COLUMN external_customers.vat_rate IS 'VAT percentage printed on this customer''s invoices. 0 embeds the normal 21% in the price instead of showing it as VAT.';
