import { amountWithEmbeddedVat } from './zeroVatPrice';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(amountWithEmbeddedVat(15, 21) === 15, '21% customer keeps the exclusive hourly rate');
assert(amountWithEmbeddedVat(15, 0) === 18.15, '0% customer is billed 15 + 21% inside the rate');
assert(amountWithEmbeddedVat(15 * 2, 0) === 36.3, 'two hours at 15 become 36.30');

console.log('zero vat price tests passed');
