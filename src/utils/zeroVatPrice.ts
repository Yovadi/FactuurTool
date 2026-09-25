export const STANDARD_VAT_RATE = 21;

/** Exclusive price plus the normal VAT, used when the invoice itself shows 0% VAT. */
export function amountWithEmbeddedVat(exclusiveAmount: number, customerVatRate: number, standardVatRate = STANDARD_VAT_RATE): number {
  const amount = Math.round((Number(exclusiveAmount) || 0) * 100) / 100;
  if (Number(customerVatRate) !== 0) return amount;
  return Math.round(amount * (1 + standardVatRate / 100) * 100) / 100;
}
