import assert from 'node:assert/strict';
import { invoiceAmountBreakdown } from './invoiceBalance';

const full = invoiceAmountBreakdown(1210, 0, 0);
assert.equal(full.showRemainder, false);
assert.equal(full.open, 1210);

const partial = invoiceAmountBreakdown(1210, 100, 400);
assert.equal(partial.showRemainder, true);
assert.equal(partial.credit, 100);
assert.equal(partial.paid, 400);
assert.equal(partial.open, 710);

console.log('invoiceSettlement.test.ts ok');
