import { amountWithEmbeddedVat, billableBeforeDiscount, summarizeMeetingInvoice } from './zeroVatPrice';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(amountWithEmbeddedVat(15, 21) === 15, '21% customer keeps the exclusive hourly rate');
assert(amountWithEmbeddedVat(15, 0) === 18.15, '0% customer is billed 15 + 21% inside the rate');
assert(amountWithEmbeddedVat(15 * 2, 0) === 36.3, 'two hours at 15 become 36.30');

assert(billableBeforeDiscount(13.5, 1.5, 21, null) === 15, '21% customer keeps the exclusive booking total');
assert(billableBeforeDiscount(13.5, 1.5, 0, null) === 18.15, '0% customer grosses an exclusive booking');
assert(billableBeforeDiscount(16.33, 1.82, 0, 0) === 18.15, 'already embedded booking is not grossed again');

const coppis = summarizeMeetingInvoice(
  [
    { total_amount: 13.5, discount_amount: 1.5, vat_rate: null },
    { total_amount: 13.5, discount_amount: 1.5, vat_rate: null },
    { total_amount: 13.5, discount_amount: 1.5, vat_rate: null },
  ],
  0,
  10,
);
assert(coppis.before === 54.45, 'three exclusive hours become 54.45');
assert(coppis.discount === 5.45, '10% is taken after the gross-up');
assert(coppis.finalAmount === 49, 'payable amount is 49.00 at 0% VAT');
assert(coppis.vatRate === 0, 'invoice VAT rate stays 0');

console.log('zero vat price tests passed');
