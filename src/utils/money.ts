export function calculateVAT(amount: number, vatRate: number, vatInclusive: boolean) {
  if (vatInclusive) {
    const subtotal = Math.round((amount / (1 + vatRate / 100)) * 100) / 100;
    const vatAmount = Math.round((amount - subtotal) * 100) / 100;
    return { subtotal, vatAmount, total: Math.round(amount * 100) / 100 };
  }
  const subtotal = Math.round(amount * 100) / 100;
  const vatAmount = Math.round((amount * (vatRate / 100)) * 100) / 100;
  return { subtotal, vatAmount, total: Math.round((subtotal + vatAmount) * 100) / 100 };
}

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

export function outstandingAmount(amount: number, appliedCredit?: number | null) {
  return Math.max(0, Math.round((Number(amount) - Number(appliedCredit || 0)) * 100) / 100);
}
