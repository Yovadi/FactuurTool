import { creditLineFromSpace, creditVatRate, invoiceFullyCovered } from './creditPrefill';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const hall = creditLineFromSpace({ space_name: 'Hal 4', monthly_rent: 1331 });
assert(hall.quantity === 1, 'credit quantity is one line, not the square metres');
assert(hall.unit_price === 1331, `credit uses the invoiced amount, got ${hall.unit_price}`);
assert(hall.amount === 1331, `credit amount, got ${hall.amount}`);

const gwe = creditLineFromSpace({ space_name: 'Voorschot Gas, Water & Electra', monthly_rent: 25 });
const lineSum = hall.amount + gwe.amount;
assert(creditVatRate({ vat_rate: 0, amount: 1356 }, lineSum) === 0, '0% stays 0%');
assert(creditVatRate({ vat_rate: 21, amount: 1639.76 }, 1356) === 21, 'exclusive 21% is added on top of the lines');
assert(creditVatRate({ vat_rate: 21, vat_inclusive: true, amount: 1356 }, lineSum) === 0, 'inclusive lines are not taxed again');
assert(invoiceFullyCovered(1356, 0, 1356), 'a full credit covers the invoice');
assert(!invoiceFullyCovered(1356, 0, 100), 'a partial credit leaves the invoice open');

console.log('credit prefill tests passed');
