import {
  BORGFACTUUR_NOTE,
  getLeaseLeadMonth,
  getLeaseStartMonth,
  isBorgfactuurNote,
  isLeaseActiveInMonth,
  isLeaseEligibleForInvoiceMonth,
  resolveLeaseInvoiceTarget,
  shiftYearMonth,
  toYearMonth,
} from './leaseInvoiceEligibility';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const trackLab = {
  id: 'lease-tracklab',
  start_date: '2027-01-01',
  end_date: '2028-12-31',
};

assert(toYearMonth('2027-01-01') === '2027-01', 'toYearMonth from date');
assert(toYearMonth('2027-01') === '2027-01', 'toYearMonth from month');
assert(shiftYearMonth('2027-01', -1) === '2026-12', 'lead month for january start');
assert(shiftYearMonth('2026-12', 1) === '2027-01', 'next month after december');
assert(getLeaseStartMonth(trackLab) === '2027-01', 'TrackLab start month');
assert(getLeaseLeadMonth(trackLab) === '2026-12', 'TrackLab lead month');

assert(!isLeaseActiveInMonth(trackLab, '2026-12'), 'classic filter excludes pre-start month');
assert(isLeaseActiveInMonth(trackLab, '2027-01'), 'active in start month');
assert(isLeaseActiveInMonth(trackLab, '2027-06'), 'active mid-lease');
assert(!isLeaseActiveInMonth(trackLab, '2029-01'), 'inactive after end');

const noInvoices: { lease_id: string; invoice_month: string }[] = [];

assert(
  isLeaseEligibleForInvoiceMonth(trackLab, '2026-12', noInvoices),
  'TrackLab selectable in december lead month without prior invoices'
);

const borg = resolveLeaseInvoiceTarget(trackLab, '2026-12', noInvoices);
assert(borg.eligible, 'borg target eligible');
assert(borg.invoiceMonth === '2027-01', 'borg invoice_month is start month');
assert(borg.notes === BORGFACTUUR_NOTE, 'borg notes');
assert(borg.isBorgfactuur, 'borg flag');

assert(
  isLeaseEligibleForInvoiceMonth(trackLab, '2027-01', noInvoices),
  'TrackLab selectable in start month'
);
const january = resolveLeaseInvoiceTarget(trackLab, '2027-01', noInvoices);
assert(january.eligible && january.invoiceMonth === '2027-01' && !january.isBorgfactuur, 'january is normal first-month invoice when selected directly');

assert(
  !isLeaseEligibleForInvoiceMonth(trackLab, '2026-11', noInvoices),
  'not eligible two months before start'
);

const withBorgInvoice = [{ lease_id: 'lease-tracklab', invoice_month: '2027-01' }];
assert(
  !isLeaseEligibleForInvoiceMonth(trackLab, '2026-12', withBorgInvoice),
  'lead month blocked once start-month invoice exists'
);
assert(
  !isLeaseEligibleForInvoiceMonth(trackLab, '2027-01', withBorgInvoice),
  'start month blocked once invoice exists'
);

const otherLeaseInvoice = [{ lease_id: 'lease-other', invoice_month: '2026-12' }];
assert(
  isLeaseEligibleForInvoiceMonth(trackLab, '2026-12', otherLeaseInvoice),
  'other lease invoices do not block TrackLab'
);

assert(isBorgfactuurNote('Borgfactuur'), 'exact borg note');
assert(isBorgfactuurNote('  Borgfactuur  '), 'trimmed borg note');
assert(!isBorgfactuurNote('Vergaderruimte boekingen:'), 'other notes are not borg');

console.log('leaseInvoiceEligibility tests passed');
