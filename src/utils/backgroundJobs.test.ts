import { asAssignmentType } from './assignmentType';

function calculateVAT(amount: number, vatRate: number, vatInclusive: boolean) {
  if (vatInclusive) {
    const subtotal = Math.round((amount / (1 + vatRate / 100)) * 100) / 100;
    const vatAmount = Math.round((amount - subtotal) * 100) / 100;
    return { subtotal, vatAmount, total: Math.round(amount * 100) / 100 };
  }
  const subtotal = Math.round(amount * 100) / 100;
  const vatAmount = Math.round((amount * (vatRate / 100)) * 100) / 100;
  return { subtotal, vatAmount, total: Math.round((subtotal + vatAmount) * 100) / 100 };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const exclusive = calculateVAT(100, 21, false);
assert(exclusive.subtotal === 100, 'ex-VAT subtotal');
assert(exclusive.vatAmount === 21, 'ex-VAT amount');
assert(exclusive.total === 121, 'ex-VAT total');

const inclusive = calculateVAT(121, 21, true);
assert(inclusive.total === 121, 'in-VAT total');
assert(inclusive.subtotal === 100, `in-VAT subtotal, got ${inclusive.subtotal}`);
assert(inclusive.vatAmount === 21, `in-VAT amount, got ${inclusive.vatAmount}`);

const skip = new Set([
  'eboekhouden_payment_status_check',
  'eboekhouden_sync_verification',
  'eboekhouden_relation_verification',
  'send_invoice_reminders',
  'generate_flex_invoices',
]);
assert(skip.has('eboekhouden_payment_status_check'), 'e-Boekhouden stays skipped');
assert(skip.has('send_invoice_reminders'), 'PDF reminders stay in the app');
assert(skip.has('generate_flex_invoices'), 'flex invoices stay skipped');
assert(!skip.has('generate_monthly_invoices'), 'monthly invoices run in the background');
assert(!skip.has('generate_meeting_room_invoices'), 'meeting-room invoices run in the background');
assert(!skip.has('settings_backup'), 'settings backup runs in the background');

assert(asAssignmentType('flexplek') === 'eigen', 'leftover flexplek maps to eigen');
assert(asAssignmentType('spreekkamer') === 'spreekkamer', 'spreekkamer stays');
assert(asAssignmentType('huurder') === 'huurder', 'huurder stays');
assert(asAssignmentType('eigen') === 'eigen', 'eigen stays');

console.log('background jobs helper tests passed');
