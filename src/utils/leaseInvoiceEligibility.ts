/** Shared eligibility for lease rent invoices, including first advance (borg) in the lead month. */

export const BORGFACTUUR_NOTE = 'Borgfactuur';

export type LeaseForEligibility = {
  id?: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type InvoiceForEligibility = {
  lease_id?: string | null;
  invoice_month?: string | null;
};

export type LeaseInvoiceTarget = {
  eligible: boolean;
  /** Month stored on the invoice (YYYY-MM). For borg this is the lease start month. */
  invoiceMonth: string;
  notes: string | null;
  isBorgfactuur: boolean;
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

export function leaseHasAnyInvoice(
  leaseId: string | undefined,
  invoices: InvoiceForEligibility[]
): boolean {
  if (!leaseId) return false;
  return invoices.some((inv) => inv.lease_id === leaseId);
}

export function leaseHasInvoiceForMonth(
  leaseId: string | undefined,
  invoices: InvoiceForEligibility[],
  invoiceMonth: string
): boolean {
  if (!leaseId) return false;
  return invoices.some(
    (inv) => inv.lease_id === leaseId && inv.invoice_month === invoiceMonth
  );
}

/**
 * Resolve whether a lease can be selected for invoice generation in `selectedMonth`,
 * and which invoice_month / notes to use.
 *
 * Leases without any earlier invoice are also allowed in the lead month (start − 1).
 * That first advance invoice uses invoice_month = start month and notes = "Borgfactuur".
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
      notes: BORGFACTUUR_NOTE,
      isBorgfactuur: true,
    };
  }

  if (!isLeaseActiveInMonth(lease, selectedMonth)) {
    return {
      eligible: false,
      invoiceMonth: selectedMonth,
      notes: null,
      isBorgfactuur: false,
    };
  }

  const exists = leaseHasInvoiceForMonth(lease.id, invoices, selectedMonth);
  return {
    eligible: !exists,
    invoiceMonth: selectedMonth,
    notes: null,
    isBorgfactuur: false,
  };
}

export function isLeaseEligibleForInvoiceMonth(
  lease: LeaseForEligibility,
  selectedMonth: string,
  invoices: InvoiceForEligibility[] = []
): boolean {
  return resolveLeaseInvoiceTarget(lease, selectedMonth, invoices).eligible;
}

export function isBorgfactuurNote(notes?: string | null): boolean {
  return (notes || '').trim() === BORGFACTUUR_NOTE;
}
