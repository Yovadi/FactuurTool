import { isBorgfactuurNote } from './leaseInvoiceEligibility';

export type DashboardInvoiceKind = 'huur' | 'boeking' | 'borg' | 'overig';

export type InvoiceForDashboardKind = {
  amount?: number | string | null;
  lease_id?: string | null;
  notes?: string | null;
};

export type InvoiceRevenueSplit = {
  huur: number;
  boeking: number;
  borg: number;
  overig: number;
};

export function dashboardInvoiceKind(invoice: InvoiceForDashboardKind): DashboardInvoiceKind {
  if (isBorgfactuurNote(invoice.notes)) return 'borg';
  const notes = invoice.notes || '';
  if (notes.includes('Vergaderruimte gebruik') || notes.includes('Vergaderruimte boekingen')) return 'boeking';
  if (invoice.lease_id) return 'huur';
  return 'overig';
}

export function dashboardInvoiceKindLabel(kind: DashboardInvoiceKind): string {
  switch (kind) {
    case 'huur': return 'Huur';
    case 'boeking': return 'Boeking';
    case 'borg': return 'Borg';
    case 'overig': return 'Overig';
  }
}

export function splitInvoiceRevenue(rows: InvoiceForDashboardKind[] | null | undefined): InvoiceRevenueSplit {
  const split: InvoiceRevenueSplit = { huur: 0, boeking: 0, borg: 0, overig: 0 };
  for (const row of rows || []) {
    const amount = Number(row.amount);
    split[dashboardInvoiceKind(row)] += Number.isFinite(amount) ? amount : 0;
  }
  return split;
}

export function invoiceRevenueTotal(split: InvoiceRevenueSplit): number {
  return split.huur + split.boeking + split.borg + split.overig;
}
