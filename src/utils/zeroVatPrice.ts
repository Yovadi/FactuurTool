export const STANDARD_VAT_RATE = 21;

/** Exclusive price plus the normal VAT, used when the invoice itself shows 0% VAT. */
export function amountWithEmbeddedVat(exclusiveAmount: number, customerVatRate: number, standardVatRate = STANDARD_VAT_RATE): number {
  const amount = Math.round((Number(exclusiveAmount) || 0) * 100) / 100;
  if (Number(customerVatRate) !== 0) return amount;
  return Math.round(amount * (1 + standardVatRate / 100) * 100) / 100;
}

export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Exclusive rent becomes the invoice amount when VAT is 0% and the price is not already inclusive. */
export function billedRentAmount(amount: number, vatRate: number, vatInclusive: boolean): number {
  if (vatInclusive || Number(vatRate) !== 0) return roundMoney(amount);
  return amountWithEmbeddedVat(amount, 0);
}

function alreadyEmbedded(storedVatRate: number | null | undefined): boolean {
  if (storedVatRate === null || storedVatRate === undefined) return false;
  return Number(storedVatRate) === 0;
}

/** Exclusive booking total, with 21% inside the price when the customer is 0% and the booking was stored exclusive. */
export function billableBeforeDiscount(
  totalAmount: number,
  discountAmount: number,
  customerVatRate: number,
  storedVatRate: number | null | undefined,
): number {
  const before = roundMoney(Number(totalAmount) + Number(discountAmount || 0));
  if (Number(customerVatRate) !== 0 || alreadyEmbedded(storedVatRate)) return before;
  return amountWithEmbeddedVat(before, 0);
}

export function billableUnitPrice(
  rate: number,
  customerVatRate: number,
  storedVatRate: number | null | undefined,
): number {
  if (Number(customerVatRate) !== 0 || alreadyEmbedded(storedVatRate)) return roundMoney(rate);
  return amountWithEmbeddedVat(rate, 0);
}

export function summarizeMeetingInvoice(
  bookings: Array<{ total_amount?: number | null; discount_amount?: number | null; vat_rate?: number | null }>,
  customerVatRate: number,
  discountPct: number,
) {
  const before = roundMoney(bookings.reduce((sum, booking) => (
    sum + billableBeforeDiscount(booking.total_amount || 0, booking.discount_amount || 0, customerVatRate, booking.vat_rate)
  ), 0));
  const discount = Number(discountPct) > 0
    ? roundMoney(before * (Number(discountPct) / 100))
    : roundMoney(bookings.reduce((sum, booking) => sum + Number(booking.discount_amount || 0), 0));
  return {
    before,
    discount,
    finalAmount: roundMoney(before - discount),
    vatRate: Number(customerVatRate),
  };
}
