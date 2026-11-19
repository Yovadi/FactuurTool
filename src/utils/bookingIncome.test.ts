import { splitBookingIncome } from './bookingIncome';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const split = splitBookingIncome([
  { total_amount: 80, tenant_id: 'tenant-1', external_customer_id: null },
  { total_amount: '120.50', tenant_id: 'tenant-2', external_customer_id: null },
  { total_amount: 45, tenant_id: null, external_customer_id: 'ext-1' },
  { total_amount: null, tenant_id: 'tenant-3', external_customer_id: null },
  { total_amount: 10, tenant_id: null, external_customer_id: null },
]);

assert(split.internal === 200.5, `internal booking income is 200.50, got ${split.internal}`);
assert(split.external === 45, `external booking income is 45, got ${split.external}`);

const empty = splitBookingIncome(null);
assert(empty.internal === 0 && empty.external === 0, 'missing rows are zero');

console.log('booking income split ok');
