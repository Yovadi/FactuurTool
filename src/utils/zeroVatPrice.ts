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

/**
 * Store a hall line as square metres times the monthly price per m².
 * The line amount stays the exact monthly total; the unit price is that total
 * divided by the area, rounded to cents.
 */
export function monthlyLineFromTotal(amount: number, squareFootage: number): { quantity: number; unitPrice: number; amount: number } {
  const total = roundMoney(amount);
  const sqm = Number(squareFootage);
  if (!(sqm > 0) || total === 0) {
    return { quantity: 1, unitPrice: total, amount: total };
  }
  return { quantity: sqm, unitPrice: roundMoney(total / sqm), amount: total };
}

export function monthlyRentFromRate(spaceType: string | undefined, squareFootage: number, ratePerSqm: number): number {
  const raw = (Number(squareFootage) || 0) * (Number(ratePerSqm) || 0);
  if (spaceType === 'bedrijfsruimte' || spaceType === 'buitenterrein') return roundMoney(raw / 12);
  return roundMoney(raw);
}
export function billedRentAmount(amount: number, vatRate: number, vatInclusive: boolean): number {
  if (vatInclusive || Number(vatRate) !== 0) return roundMoney(amount);
  return amountWithEmbeddedVat(amount, 0);
}

export function billedCatalogRent(
  space: { space_type?: string; square_footage?: number | string | null; rate_per_sqm?: number | string | null; diversen_calculation?: string | null } | null | undefined,
  storedRate: number,
  storedMonthly: number,
  vatRate: number,
): { rate: number; monthly: number } {
  const live = Number(space?.rate_per_sqm);
  const rate = live > 0 ? live : Number(storedRate) || 0;
  const exclusiveMonthly = rate > 0
    ? monthlyRentFromRate(space?.space_type, Number(space?.square_footage) || 0, rate)
    : Number(storedMonthly) || 0;
  return {
    rate: billedRentAmount(rate, vatRate, false),
    monthly: billedRentAmount(exclusiveMonthly, vatRate, false),
  };
}

export function billedLeaseSpaceMonthly(
  space: { space_type?: string; square_footage?: number | string | null; rate_per_sqm?: number | string | null; diversen_calculation?: string | null } | null | undefined,
  storedRate: number,
  storedMonthly: number,
  vatRate: number,
): { monthly: number; rate: number; quantity: number } {
  const fixedDiversen = space?.space_type === 'diversen' && (!space.diversen_calculation || space.diversen_calculation === 'fixed');
  if (fixedDiversen) {
    const monthly = billedRentAmount(Number(storedRate) || Number(storedMonthly), vatRate, false);
    return { monthly, rate: monthly, quantity: 1 };
  }
  const billed = billedCatalogRent(space, storedRate, storedMonthly, vatRate);
  const squareFootage = Number(space?.square_footage) || 0;
  return {
    monthly: billed.monthly,
    rate: billed.rate,
    quantity: squareFootage > 0 ? squareFootage : 1,
  };
}

export function billedLeaseMonthly(
  spaces: Array<{ price_per_sqm?: number | string | null; monthly_rent?: number | string | null; space?: { space_type?: string; square_footage?: number | string | null; rate_per_sqm?: number | string | null; diversen_calculation?: string | null } | null }>,
  vatRate: number,
  securityDeposit = 0,
  discountPct = 0,
): number {
  const rent = spaces.reduce((sum, ls) => (
    sum + billedLeaseSpaceMonthly(ls.space, Number(ls.price_per_sqm), Number(ls.monthly_rent), vatRate).monthly
  ), 0);
  const discount = Number(discountPct) > 0 ? roundMoney(rent * (Number(discountPct) / 100)) : 0;
  return roundMoney(rent - discount + (Number(securityDeposit) || 0));
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
