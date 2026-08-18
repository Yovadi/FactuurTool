import { bookingTimesOverlap } from '../src/utils/bookingOverlap.ts';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(bookingTimesOverlap('09:00', '10:00', '09:30', '11:00'), 'overlap start inside');
assert(bookingTimesOverlap('09:00', '12:00', '10:00', '11:00'), 'overlap enclosing');
assert(!bookingTimesOverlap('09:00', '10:00', '10:00', '11:00'), 'adjacent is not overlap');
assert(!bookingTimesOverlap('09:00', '10:00', '10:30', '11:00'), 'separate slots');
assert(bookingTimesOverlap('09:00:00', '10:00:00', '09:30:00', '11:00:00'), 'seconds stripped');

console.log('silent overlap helper checks passed');
