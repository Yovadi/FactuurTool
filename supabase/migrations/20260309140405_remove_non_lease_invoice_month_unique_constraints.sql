/*
  # Remove non-lease invoice month unique constraints

  1. Changes
    - Drop unique index `invoices_tenant_month_unique` that prevented multiple invoices per tenant per month
    - Drop unique index `invoices_external_customer_month_unique` that prevented multiple invoices per external customer per month
    - The lease-level constraint (`invoices_lease_month_unique`) is kept intact

  2. Reason
    - Users need to create multiple invoices for the same customer in the same month
      (e.g., separate booking invoices for February and March both assigned to invoice month March)
    - A soft check with confirmation dialog replaces the hard database constraint
*/

DROP INDEX IF EXISTS invoices_tenant_month_unique;
DROP INDEX IF EXISTS invoices_external_customer_month_unique;
