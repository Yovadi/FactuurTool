import { strict as assert } from 'node:assert';
import { calculateVAT, roundMoney } from './invoiceMoney.ts';

assert.equal(roundMoney(10.005), 10.01);
assert.equal(roundMoney(1.234), 1.23);

const exclusive = calculateVAT(100, 21, false);
assert.equal(exclusive.subtotal, 100);
assert.equal(exclusive.vatAmount, 21);
assert.equal(exclusive.total, 121);

const inclusive = calculateVAT(121, 21, true);
assert.equal(inclusive.total, 121);
assert.equal(inclusive.subtotal, 100);
assert.equal(inclusive.vatAmount, 21);

const cents = calculateVAT(33.33, 21, false);
assert.equal(cents.subtotal, 33.33);
assert.equal(cents.vatAmount, 7);
assert.equal(cents.total, 40.33);

console.log('invoiceMoney checks passed');
