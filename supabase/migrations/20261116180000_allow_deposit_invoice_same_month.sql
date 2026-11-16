/*
  # Deposit column and one rent invoice plus one deposit invoice per month

  leases.deposit_amount is the refundable waarborgsom.
  security_deposit stays the monthly gas, water and electricity advance.

  invoices_lease_month_unique used to allow only one invoice per lease per
  month, so the first rent and the deposit invoice could not both use the
  start month. Rent invoices stay unique per month. A deposit invoice, marked
  by a note whose first line is "Borgfactuur", is unique per lease instead.
*/

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS invoices_lease_month_unique;

CREATE UNIQUE INDEX invoices_lease_month_unique
  ON invoices (lease_id, invoice_month)
  WHERE lease_id IS NOT NULL
    AND COALESCE(split_part(notes, E'\n', 1), '') <> 'Borgfactuur';

CREATE UNIQUE INDEX IF NOT EXISTS invoices_lease_borg_unique
  ON invoices (lease_id)
  WHERE lease_id IS NOT NULL
    AND COALESCE(split_part(notes, E'\n', 1), '') = 'Borgfactuur';
