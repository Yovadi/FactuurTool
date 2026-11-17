import assert from 'node:assert/strict';
import { invoiceAmountBreakdown, paymentToMatchBookkeeping } from './invoiceBalance';

const full = invoiceAmountBreakdown(1210, 0, 0);
assert.equal(full.showRemainder, false);
assert.equal(full.open, 1210);

const partial = invoiceAmountBreakdown(1210, 100, 400);
assert.equal(partial.showRemainder, true);
assert.equal(partial.credit, 100);
assert.equal(partial.paid, 400);
assert.equal(partial.open, 710);

assert.equal(
  paymentToMatchBookkeeping({ amount: 1210, appliedCredit: 100, paidAmount: 0, amountOpen: 710 }),
  400,
  'the gap between the local open amount and e-Boekhouden is the payment to record'
);
assert.equal(
  paymentToMatchBookkeeping({ amount: 1210, appliedCredit: 100, paidAmount: 400, amountOpen: 710 }),
  0,
  'a second sync does not record the same payment again'
);
assert.equal(
  paymentToMatchBookkeeping({ amount: 1210, appliedCredit: 100, paidAmount: 0, amountOpen: 0 }),
  1110,
  'a fully paid bookkeeping invoice records the whole local remainder'
);
assert.equal(
  paymentToMatchBookkeeping({ amount: 1210, appliedCredit: 0, paidAmount: 0, amountOpen: 1210 }),
  0,
  'an untouched invoice records nothing'
);

console.log('invoiceSettlement.test.ts ok');
