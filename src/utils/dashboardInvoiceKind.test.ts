import {
  dashboardInvoiceKind,
  dashboardInvoiceKindLabel,
  invoiceRevenueTotal,
  splitInvoiceRevenue,
} from './dashboardInvoiceKind';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(dashboardInvoiceKind({ lease_id: 'lease-1', notes: 'Borgfactuur\nWaarborgsom' }) === 'borg', 'a deposit note wins over the lease');
assert(dashboardInvoiceKind({ lease_id: 'lease-1', notes: null }) === 'huur', 'a lease invoice is rent');
assert(dashboardInvoiceKind({ lease_id: null, notes: 'Vergaderruimte boekingen:\n- Zaal' }) === 'boeking', 'meeting notes are a booking invoice');
assert(dashboardInvoiceKind({ lease_id: null, notes: 'Vergaderruimte gebruik' }) === 'boeking', 'older meeting notes stay a booking invoice');
assert(dashboardInvoiceKind({ lease_id: null, notes: 'Handmatig' }) === 'overig', 'anything else stays other');

assert(dashboardInvoiceKindLabel('huur') === 'Huur', 'rent label');
assert(dashboardInvoiceKindLabel('boeking') === 'Boeking', 'booking label');

const split = splitInvoiceRevenue([
  { amount: 1000, lease_id: 'lease-1', notes: null },
  { amount: '250.50', lease_id: null, notes: 'Vergaderruimte boekingen:' },
  { amount: 400, lease_id: 'lease-2', notes: 'Borgfactuur' },
  { amount: 10, lease_id: null, notes: null },
  { amount: null, lease_id: 'lease-3', notes: null },
]);

assert(split.huur === 1000, `rent is 1000, got ${split.huur}`);
assert(split.boeking === 250.5, `bookings are 250.50, got ${split.boeking}`);
assert(split.borg === 400, `deposits are 400, got ${split.borg}`);
assert(split.overig === 10, `other is 10, got ${split.overig}`);
assert(invoiceRevenueTotal(split) === 1660.5, `total follows the split, got ${invoiceRevenueTotal(split)}`);

const empty = splitInvoiceRevenue(null);
assert(invoiceRevenueTotal(empty) === 0, 'missing rows are zero');

console.log('dashboard invoice kind ok');
