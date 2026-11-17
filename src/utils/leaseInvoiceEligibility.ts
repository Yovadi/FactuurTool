/** Shared eligibility for lease rent invoices and a separate refundable deposit invoice. */

export const BORGFACTUUR_NOTE = 'Borgfactuur';
export const BORGFACTUUR_NOTES = 'Borgfactuur\nWaarborgsom. Dit bedrag wordt aan het einde van het contract teruggestort.';

export type LeaseForEligibility = {
  id?: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type InvoiceForEligibility = {
  lease_id?: string | null;
  invoice_month?: string | null;
  notes?: string | null;
};

export type LeaseInvoiceTarget = {
  eligible: boolean;
  /** Month stored on the invoice (YYYY-MM). Advance rent uses the lease start month. */
  invoiceMonth: string;
  notes: string | null;
  isBorgfactuur: boolean;
  /** First rent invoice, created in the month before the lease starts. */
  isAdvanceRent: boolean;
  amount?: number;
};

/** Normalize a date (YYYY-MM-DD) or month (YYYY-MM) to YYYY-MM. */
export function toYearMonth(dateOrMonth: string): string {
  return dateOrMonth.slice(0, 7);
}

/** Shift a YYYY-MM value by `delta` calendar months. */
export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getLeaseStartMonth(lease: { start_date?: string | null }): string | null {
  if (!lease.start_date) return null;
  return toYearMonth(lease.start_date);
}

/** Lead month = start month − 1 (rent is billed one month ahead). */
export function getLeaseLeadMonth(lease: { start_date?: string | null }): string | null {
  const start = getLeaseStartMonth(lease);
  if (!start) return null;
  return shiftYearMonth(start, -1);
}

/**
 * Classic active-in-month check: lease overlaps the selected calendar month.
 * Filters out leases whose start_date is after the selected month.
 */
export function isLeaseActiveInMonth(
  lease: { start_date?: string | null; end_date?: string | null },
  invoiceMonth: string
): boolean {
  if (!invoiceMonth) return true;
  const [y, m] = invoiceMonth.split('-').map(Number);
  if (!y || !m) return true;
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0);
  if (lease.start_date) {
    const startDate = new Date(lease.start_date);
    if (startDate > monthEnd) return false;
  }
  if (lease.end_date) {
    const endDate = new Date(lease.end_date);
    if (endDate < monthStart) return false;
  }
  return true;
}

export function isBorgfactuurNote(notes?: string | null): boolean {
  return (notes || '').split('\n')[0].trim() === BORGFACTUUR_NOTE;
}

function rentInvoices(invoices: InvoiceForEligibility[]): InvoiceForEligibility[] {
  return invoices.filter((inv) => !isBorgfactuurNote(inv.notes));
}

export function leaseHasAnyInvoice(
  leaseId: string | undefined,
  invoices: InvoiceForEligibility[]
): boolean {
  if (!leaseId) return false;
  return rentInvoices(invoices).some((inv) => inv.lease_id === leaseId);
}

export function leaseHasInvoiceForMonth(
  leaseId: string | undefined,
  invoices: InvoiceForEligibility[],
  invoiceMonth: string
): boolean {
  if (!leaseId) return false;
  return rentInvoices(invoices).some(
    (inv) => inv.lease_id === leaseId && inv.invoice_month === invoiceMonth
  );
}

export function depositAmountOf(lease: { deposit_amount?: number | string | null }): number {
  const value = Number(lease.deposit_amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Resolve whether a lease can be selected for invoice generation in `selectedMonth`,
 * and which invoice_month / notes to use.
 *
 * Leases without an earlier rent invoice are also allowed in the lead month (start − 1).
 * That first invoice is ordinary rent for the start month, paid one month ahead.
 * A refundable deposit is a separate invoice; see resolveDepositInvoice.
 */
export function resolveLeaseInvoiceTarget(
  lease: LeaseForEligibility,
  selectedMonth: string,
  invoices: InvoiceForEligibility[] = []
): LeaseInvoiceTarget {
  if (typeof selectedMonth !== 'string' || !selectedMonth) {
    return {
      eligible: true,
      invoiceMonth: '',
      notes: null,
      isBorgfactuur: false,
      isAdvanceRent: false,
    };
  }

  const startMonth = getLeaseStartMonth(lease);
  const leadMonth = getLeaseLeadMonth(lease);
  const hasAnyInvoice = leaseHasAnyInvoice(lease.id, invoices);
  const isLeadMonthFirst = !hasAnyInvoice && !!leadMonth && leadMonth === selectedMonth;

  if (isLeadMonthFirst && startMonth) {
    const exists = leaseHasInvoiceForMonth(lease.id, invoices, startMonth);
    return {
      eligible: !exists,
      invoiceMonth: startMonth,
      notes: null,
      isBorgfactuur: false,
      isAdvanceRent: true,
    };
  }

  if (!isLeaseActiveInMonth(lease, selectedMonth)) {
    return {
      eligible: false,
      invoiceMonth: selectedMonth,
      notes: null,
      isBorgfactuur: false,
      isAdvanceRent: false,
    };
  }

  const exists = leaseHasInvoiceForMonth(lease.id, invoices, selectedMonth);
  return {
    eligible: !exists,
    invoiceMonth: selectedMonth,
    notes: null,
    isBorgfactuur: false,
    isAdvanceRent: false,
  };
}

/**
 * Separate refundable deposit. It does not replace the rent invoice and is
 * not tied to the first rent month. Any selected month is allowed, once per lease.
 */
export function resolveDepositInvoice(
  lease: LeaseForEligibility & { deposit_amount?: number | string | null },
  selectedMonth: string,
  invoices: InvoiceForEligibility[] = []
): LeaseInvoiceTarget | null {
  const amount = depositAmountOf(lease);
  if (!amount || typeof selectedMonth !== 'string' || !selectedMonth) return null;
  if (invoices.some((inv) => inv.lease_id === lease.id && isBorgfactuurNote(inv.notes))) return null;

  return {
    eligible: true,
    invoiceMonth: selectedMonth,
    notes: BORGFACTUUR_NOTES,
    isBorgfactuur: true,
    isAdvanceRent: false,
    amount,
  };
}

export function isLeaseEligibleForInvoiceMonth(
  lease: LeaseForEligibility,
  selectedMonth: string,
  invoices: InvoiceForEligibility[] = []
): boolean {
  return resolveLeaseInvoiceTarget(lease, selectedMonth, invoices).eligible;
}

