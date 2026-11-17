/*
  # Refundable lease deposit

  Adds leases.deposit_amount for the waarborgsom.
  This is separate from security_deposit, which is the monthly
  gas, water and electricity advance.
  The deposit is invoiced once and returned at the end of the lease.
*/

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) NOT NULL DEFAULT 0;
