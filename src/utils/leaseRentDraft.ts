import { addCalendarDays, amsterdamCalendar } from './amsterdamCalendar';
import { resolveLeaseInvoiceTarget, type InvoiceForEligibility } from './leaseInvoiceEligibility';
import { billedLeaseSpaceMonthly, monthlyLineFromTotal, roundMoney } from './zeroVatPrice';

export type RentSpace = {
  price_per_sqm?: number | string | null;
  monthly_rent?: number | string | null;
  space?: {
    space_number?: string | null;
    space_type?: string | null;
    square_footage?: number | string | null;
    rate_per_sqm?: number | string | null;
    diversen_calculation?: string | null;
  } | null;
};

export type RentLease = {
  id?: string;
  start_date?: string | null;
  end_date?: string | null;
  vat_rate?: number | string | null;
  vat_inclusive?: boolean | null;
  security_deposit?: number | string | null;
  tenant?: { lease_discount_percentage?: number | string | null } | null;
  lease_spaces?: RentSpace[] | null;
};

export type RentDraftLine = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  local_category: string | null;
};

export type LeaseRentDraft = {
  invoiceMonth: string;
  invoiceDate: string;
  dueDate: string;
  notes: string | null;
  subtotal: number;
  vatAmount: number;
  amount: number;
  vatRate: number;
  vatInclusive: boolean;
  lines: RentDraftLine[];
};

function localCategory(spaceType?: string | null): string | null {
  switch (spaceType) {
    case 'kantoor': return 'huur_kantoor';
    case 'bedrijfsruimte': return 'huur_bedrijfsruimte';
    case 'buitenterrein': return 'huur_buitenterrein';
    case 'diversen': return 'diversen';
    default: return null;
  }
}

function spaceLabel(spaceNumber: string, spaceType?: string | null): string {
  if (spaceType !== 'bedrijfsruimte') return spaceNumber;
  const numOnly = spaceNumber.replace(/^(Bedrijfsruimte|Hal)\s*/i, '').trim();
  return /^\d+/.test(numOnly) ? `Hal ${numOnly}` : spaceNumber;
}

function calculateVAT(amount: number, vatRate: number, vatInclusive: boolean) {
  if (vatInclusive) {
    const total = roundMoney(amount);
    const subtotal = roundMoney(amount / (1 + vatRate / 100));
    return { subtotal, vatAmount: roundMoney(total - subtotal), total };
  }
  const subtotal = roundMoney(amount);
  const vatAmount = roundMoney(amount * (vatRate / 100));
  return { subtotal, vatAmount, total: roundMoney(subtotal + vatAmount) };
}

/**
 * One rent draft for the Amsterdam month, using the same rules as the screen.
 * A refundable deposit is not included. Returns null when this lease has
 * nothing to invoice for the month.
 */
export function buildLeaseRentDraft(
  lease: RentLease,
  invoices: InvoiceForEligibility[],
  instant: Date = new Date(),
): LeaseRentDraft | null {
  const calendar = amsterdamCalendar(instant);
  const target = resolveLeaseInvoiceTarget(lease, calendar.yearMonth, invoices);
  if (!target.eligible || !target.invoiceMonth) return null;

  const vatRate = Number(lease.vat_rate) || 0;
  const vatInclusive = !!lease.vat_inclusive;
  const lines: RentDraftLine[] = [];
  let rentAmount = 0;

  for (const entry of lease.lease_spaces || []) {
    const space = entry.space;
    const billed = billedLeaseSpaceMonthly(space, Number(entry.price_per_sqm), Number(entry.monthly_rent), vatRate);
    const fixed = space?.space_type === 'diversen' && (!space.diversen_calculation || space.diversen_calculation === 'fixed');
    const stored = fixed
      ? { quantity: 1, unitPrice: billed.monthly, amount: billed.monthly }
      : monthlyLineFromTotal(billed.monthly, Number(space?.square_footage) || 0);
    rentAmount = roundMoney(rentAmount + billed.monthly);
    lines.push({
      description: spaceLabel(space?.space_number || 'Ruimte', space?.space_type),
      quantity: stored.quantity,
      unit_price: stored.unitPrice,
      amount: stored.amount,
      local_category: localCategory(space?.space_type),
    });
  }

  const discountPct = Number(lease.tenant?.lease_discount_percentage) || 0;
  const discountAmount = discountPct > 0 ? roundMoney(rentAmount * (discountPct / 100)) : 0;
  if (discountAmount > 0) {
    lines.push({
      description: `Korting verhuur (${discountPct}%)`,
      quantity: 1,
      unit_price: -discountAmount,
      amount: -discountAmount,
      local_category: null,
    });
  }

  const deposit = Number(lease.security_deposit) || 0;
  if (deposit > 0) {
    lines.push({
      description: 'Voorschot Gas, Water & Electra',
      quantity: 1,
      unit_price: deposit,
      amount: deposit,
      local_category: 'diversen',
    });
  }

  const base = roundMoney(rentAmount - discountAmount + deposit);
  const totals = calculateVAT(base, vatRate, vatInclusive);
  return {
    invoiceMonth: target.invoiceMonth,
    invoiceDate: calendar.date,
    dueDate: addCalendarDays(calendar.date, 14),
    notes: target.notes,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    amount: totals.total,
    vatRate,
    vatInclusive,
    lines,
  };
}
