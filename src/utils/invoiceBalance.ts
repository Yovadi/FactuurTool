export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** What is still open after credit notes and recorded payments. */
export function openInvoiceAmount(amount: number, appliedCredit = 0, paidAmount = 0): number {
  return Math.max(0, roundMoney((Number(amount) || 0) - (Number(appliedCredit) || 0) - (Number(paidAmount) || 0)));
}

export function invoiceFullySettled(amount: number, appliedCredit = 0, paidAmount = 0): boolean {
  return openInvoiceAmount(amount, appliedCredit, paidAmount) <= 0.009;
}
