/** Copy the amounts that were actually invoiced onto a credit note. */

export type CreditLine = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

export type InvoicedSpace = {
  space_name?: string | null;
  monthly_rent?: number | string | null;
};

export type CreditSourceInvoice = {
  vat_rate?: number | string | null;
  vat_inclusive?: boolean | null;
  amount?: number | string | null;
};

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** One credit line for the billed line amount. Quantity stays 1 so an annual rate is not multiplied again. */
export function creditLineFromSpace(space: InvoicedSpace): CreditLine {
  const amount = money(Number(space.monthly_rent) || 0);
  return {
    description: space.space_name || '',
    quantity: 1,
    unit_price: amount,
    amount,
  };
}

/**
 * VAT percentage for the credit form.
 * A rate of 0 stays 0. When the lines already equal the invoice total, VAT is not added a second time.
 */
export function creditVatRate(invoice: CreditSourceInvoice, lineSum: number): number {
  const raw = invoice.vat_rate;
  const rate = raw === null || raw === undefined || raw === '' ? 21 : Number(raw);
  const vatRate = Number.isFinite(rate) ? rate : 21;
  if (vatRate === 0) return 0;
  const total = Number(invoice.amount);
  if (Number.isFinite(total) && Math.abs(money(lineSum) - money(total)) < 0.05) return 0;
  if (invoice.vat_inclusive && Number.isFinite(total) && money(lineSum) >= money(total) - 0.05) return 0;
  return vatRate;
}

export function invoiceFullyCovered(amount: number, alreadyApplied: number, applying: number): boolean {
  const covered = (Number(alreadyApplied) || 0) + (Number(applying) || 0);
  return covered + 0.009 >= Number(amount);
}
