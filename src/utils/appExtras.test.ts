import { suggestAlternativeSlots, slotsOverlap } from './bookingSlots';
import { redactSettings } from './settingsBackup';
import { buildUblInvoiceXml } from './ublInvoice';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run() {
  assert(slotsOverlap({ start: '09:00', end: '10:00' }, { start: '09:30', end: '11:00' }), 'overlap should detect crossing times');
  assert(!slotsOverlap({ start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' }), 'adjacent slots do not overlap');

  const suggestions = suggestAlternativeSlots(
    { start: '09:00', end: '10:00' },
    [{ start: '09:00', end: '10:00' }, { start: '11:00', end: '12:00' }]
  );
  assert(suggestions.length > 0, 'should suggest another slot');
  assert(suggestions[0].start === '08:00', `first free slot should be 08:00, got ${suggestions[0].start}`);
  assert(suggestions.some(slot => slot.start === '10:00'), 'should also suggest the 10:00 gap');

  const redacted = redactSettings({ smtp_password: 'secret', company_name: 'HAL5' });
  assert(redacted.smtp_password === '[redacted]', 'secrets must be stripped from backups');
  assert(redacted.company_name === 'HAL5', 'non-secrets stay in backups');

  const ubl = buildUblInvoiceXml({
    invoiceNumber: 'INV-2026-001',
    invoiceDate: '2026-08-19',
    dueDate: '2026-09-02',
    supplier: { name: 'HAL5', address: 'Straat 1', postalCode: '5825 AA', city: 'Overloon' },
    customer: { name: 'Huurder BV' },
    lines: [{ description: 'Kantoor A', quantity: 1, unitPrice: 100, amount: 100 }],
    subtotal: 100,
    vatAmount: 21,
    vatRate: 21,
    total: 121,
  });
  assert(ubl.includes('INV-2026-001'), 'UBL XML should contain invoice number');
  assert(ubl.includes('Huurder BV'), 'UBL XML should contain customer name');
  assert(!ubl.includes('iDEAL') && !ubl.includes('payment means'), 'UBL download must not add payment methods');

  console.log('app extras helper tests passed');
}

run();
