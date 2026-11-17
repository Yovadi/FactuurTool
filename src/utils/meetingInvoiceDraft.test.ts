import { buildMeetingInvoiceDraft, meetingBookingCharge, previousAmsterdamMonth } from './meetingInvoiceDraft';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const decemberStart = new Date('2026-11-30T23:15:00Z');
const period = previousAmsterdamMonth(decemberStart);
assert(period.yearMonth === '2026-11', `previous Amsterdam month is November, got ${period.yearMonth}`);
assert(period.end === '2026-11-30', `November ends on the 30th, got ${period.end}`);

const zeroVat = buildMeetingInvoiceDraft([{
  id: 'b1',
  booking_date: '2026-11-12',
  start_time: '09:00',
  end_time: '10:00',
  total_hours: 1,
  hourly_rate: 15,
  total_amount: 15,
  discount_amount: 0,
  vat_rate: null,
  space_number: 'Vergaderruimte 1',
}], 0, 0, period.yearMonth, decemberStart);
assert(zeroVat, 'a booking produces a draft');
assert(zeroVat.amount === 18.15, `0% customer is billed 18.15, got ${zeroVat.amount}`);
assert(zeroVat.vatAmount === 0, 'header VAT stays 0');
assert(zeroVat.vatRate === 0, 'vat rate stays 0');
assert(zeroVat.invoiceDate === '2026-12-01', `invoice date is 1 December Amsterdam, got ${zeroVat.invoiceDate}`);
assert(zeroVat.lines[0].amount === 18.15, 'the line uses the grossed amount');

const alreadyGross = meetingBookingCharge({
  booking_date: '2026-11-12',
  total_amount: 18.15,
  discount_amount: 0,
  vat_rate: 0,
}, 0, 0);
assert(alreadyGross === 18.15, `an embedded booking is not grossed twice, got ${alreadyGross}`);

const standard = buildMeetingInvoiceDraft([{
  booking_date: '2026-11-12',
  total_amount: 13.5,
  discount_amount: 1.5,
  vat_rate: 21,
}], 21, 0, '2026-11', decemberStart);
assert(standard, '21% booking drafts');
assert(standard.lines[0].amount === 15, `the line shows the price before discount, got ${standard.lines[0].amount}`);
assert(standard.subtotal === 13.5, `the invoice base is after the stored discount, got ${standard.subtotal}`);
assert(standard.amount === 16.34, `21% is added on the header, got ${standard.amount}`);

const discounted = meetingBookingCharge({
  booking_date: '2026-11-12',
  total_amount: 15,
  discount_amount: 0,
  vat_rate: null,
}, 0, 10);
assert(discounted === 16.33, `10% off the grossed price, got ${discounted}`);

console.log('meeting invoice draft tests passed');
