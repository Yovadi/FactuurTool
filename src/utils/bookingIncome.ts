export type BookingIncomeRow = {
  total_amount: number | string | null;
  tenant_id?: string | null;
  external_customer_id?: string | null;
};

export function splitBookingIncome(rows: BookingIncomeRow[] | null | undefined): {
  internal: number;
  external: number;
} {
  let internal = 0;
  let external = 0;
  for (const row of rows || []) {
    const amount = Number(row.total_amount);
    const value = Number.isFinite(amount) ? amount : 0;
    if (row.external_customer_id) external += value;
    else if (row.tenant_id) internal += value;
  }
  return { internal, external };
}
