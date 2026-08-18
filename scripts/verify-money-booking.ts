import { bookingTimesOverlap } from '../src/utils/bookingOverlap.ts';
import { calculateVAT, isLeaseActiveInMonth, outstandingAmount, localDateString } from '../src/utils/money.ts';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(bookingTimesOverlap('09:00', '10:00', '09:30', '11:00'), 'overlap start inside');
assert(bookingTimesOverlap('09:00', '12:00', '10:00', '11:00'), 'overlap enclosing');
assert(!bookingTimesOverlap('09:00', '10:00', '10:00', '11:00'), 'adjacent is not overlap');
assert(!bookingTimesOverlap('09:00', '10:00', '10:30', '11:00'), 'separate slots');

const exclusive = calculateVAT(100, 21, false);
assert(exclusive.subtotal === 100, `exclusive subtotal ${exclusive.subtotal}`);
assert(exclusive.vatAmount === 21, `exclusive vat ${exclusive.vatAmount}`);
assert(exclusive.total === 121, `exclusive total ${exclusive.total}`);

const inclusive = calculateVAT(121, 21, true);
assert(inclusive.total === 121, `inclusive total ${inclusive.total}`);
assert(inclusive.subtotal === 100, `inclusive subtotal ${inclusive.subtotal}`);
assert(inclusive.vatAmount === 21, `inclusive vat ${inclusive.vatAmount}`);

assert(outstandingAmount(100, 25) === 75, 'outstanding after credit');
assert(outstandingAmount(100, 150) === 0, 'outstanding never negative');

const local = localDateString(new Date(2026, 7, 18, 23, 30));
assert(local === '2026-08-18', `local date ${local}`);

assert(isLeaseActiveInMonth({ start_date: '2026-03-01', end_date: '2026-12-31' }, '2026-03'), 'lease starts in month');
assert(!isLeaseActiveInMonth({ start_date: '2026-04-01', end_date: '2026-12-31' }, '2026-03'), 'lease starts after month');
assert(!isLeaseActiveInMonth({ start_date: '2025-01-01', end_date: '2026-02-28' }, '2026-03'), 'lease ended before month');

console.log('money and booking helper checks passed');
