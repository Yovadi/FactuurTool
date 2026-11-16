import { buildLeaseRentDraft, missingRentForPastMonths } from './leaseRentDraft';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const trackLab = {
  id: 'lease-tracklab',
  start_date: '2027-01-01',
  end_date: '2028-01-01',
  vat_rate: 0,
  vat_inclusive: false,
  security_deposit: 25,
  tenant: { lease_discount_percentage: 0 },
  lease_spaces: [{
    price_per_sqm: 45.38,
    monthly_rent: 1100,
    space: { space_number: 'Hal 4', space_type: 'bedrijfsruimte', square_footage: 352, rate_per_sqm: 37.5 },
  }],
};

const december = new Date('2026-11-30T23:30:00Z');
const advance = buildLeaseRentDraft(trackLab, [], december);
assert(advance, 'December creates the January advance rent');
assert(advance.invoiceMonth === '2027-01', `advance month, got ${advance.invoiceMonth}`);
assert(advance.invoiceDate === '2026-12-01', `invoice date follows Amsterdam, got ${advance.invoiceDate}`);
assert(advance.amount === 1356, `Hal 4 plus GWE is 1356, got ${advance.amount}`);
assert(advance.vatAmount === 0, '0% VAT stays on the header');
const hall = advance.lines[0];
assert(hall.quantity === 352, 'quantity is the square metres');
assert(hall.unit_price === 3.78, `monthly price per m2, got ${hall.unit_price}`);
assert(hall.amount === 1331, `hall amount, got ${hall.amount}`);
assert(advance.lines[1].description === 'Voorschot Gas, Water & Electra', 'GWE stays on the rent invoice');
assert(!advance.lines.some((line) => line.description === 'Waarborgsom'), 'the deposit invoice is not created here');

const again = buildLeaseRentDraft(trackLab, [{ lease_id: 'lease-tracklab', invoice_month: '2027-01', notes: null }], december);
assert(again === null, 'the start month is not invoiced twice');

const discounted = buildLeaseRentDraft({
  ...trackLab,
  tenant: { lease_discount_percentage: 10 },
}, [], december);
assert(discounted, 'discounted lease still invoices');
assert(discounted.amount === 1222.9, `10% off the hall rent, GWE remains, got ${discounted.amount}`);

const missingAdvance = missingRentForPastMonths(trackLab, [], ['2026-11', '2026-12', '2027-01']);
assert(missingAdvance.length === 1, `advance rent is counted once, got ${missingAdvance.length}`);
assert(missingAdvance[0].month === '2026-12', `shown in the month it should be made, got ${missingAdvance[0].month}`);
assert(missingAdvance[0].amount === 1356, `unbilled amount matches the draft, got ${missingAdvance[0].amount}`);

const afterInvoice = missingRentForPastMonths(
  trackLab,
  [{ lease_id: 'lease-tracklab', invoice_month: '2027-01', notes: null }],
  ['2026-12', '2027-01'],
);
assert(afterInvoice.length === 0, 'an existing rent invoice is not still unbilled');

const borgOnly = missingRentForPastMonths(
  trackLab,
  [{ lease_id: 'lease-tracklab', invoice_month: '2026-12', notes: 'Borgfactuur\nWaarborgsom' }],
  ['2026-12'],
);
assert(borgOnly.length === 1 && borgOnly[0].amount === 1356, 'a deposit invoice does not replace the rent');

const discountedMissing = missingRentForPastMonths({
  ...trackLab,
  tenant: { lease_discount_percentage: 10 },
}, [], ['2026-12']);
assert(discountedMissing[0].amount === 1222.9, `unbilled discount matches the draft, got ${discountedMissing[0].amount}`);

console.log('lease rent draft tests passed');
