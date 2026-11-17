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

export type InvoiceAmountBreakdown = {
  credit: number;
  paid: number;
  open: number;
  /** True when credit or a payment already reduced the invoice total. */
  showRemainder: boolean;
};

/** Totals for the PDF: the invoice amount stays, and the remainder is shown once something is settled. */
export function invoiceAmountBreakdown(amount: number, appliedCredit = 0, paidAmount = 0): InvoiceAmountBreakdown {
  const credit = roundMoney(Math.max(0, Number(appliedCredit) || 0));
  const paid = roundMoney(Math.max(0, Number(paidAmount) || 0));
  return {
    credit,
    paid,
    open: openInvoiceAmount(amount, credit, paid),
    showRemainder: credit > 0.009 || paid > 0.009,
  };
}

/**
 * Payment to record so the local open amount matches what e-Boekhouden still has open.
 * A zero result means the books do not show a new payment beyond what the app already has.
 */
export function paymentToMatchBookkeeping(input: {
  amount: number;
  appliedCredit?: number;
  paidAmount?: number;
  amountOpen: number;
}): number {
  const localOpen = openInvoiceAmount(input.amount, input.appliedCredit, input.paidAmount);
  const booksOpen = Math.max(0, roundMoney(Number(input.amountOpen) || 0));
  return roundMoney(Math.max(0, localOpen - booksOpen));
}
