import {
  BORGFACTUUR_NOTES,
  getLeaseLeadMonth,
  getLeaseStartMonth,
  isBorgfactuurNote,
  isLeaseActiveInMonth,
  isLeaseEligibleForInvoiceMonth,
  resolveDepositInvoice,
  resolveLeaseInvoiceTarget,
  pastMonthsBefore,
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
const past = pastMonthsBefore('2027-02-15');
assert(past[0] === '2026-08' && past[past.length - 1] === '2027-01', 'unbilled months follow the test date');
assert(!past.includes('2027-02'), 'the current test month is not yet unbilled');
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

const advance = resolveLeaseInvoiceTarget(trackLab, '2026-12', noInvoices);
assert(advance.eligible, 'december advance rent is eligible');
assert(advance.invoiceMonth === '2027-01', 'advance rent is stored as the start month');
assert(advance.notes === null, 'advance rent is not a deposit invoice');
assert(advance.isAdvanceRent && !advance.isBorgfactuur, 'december is the first rent invoice, not the deposit');

assert(
  isLeaseEligibleForInvoiceMonth(trackLab, '2027-01', noInvoices),
  'TrackLab selectable in start month'
);
const january = resolveLeaseInvoiceTarget(trackLab, '2027-01', noInvoices);
assert(january.eligible && january.invoiceMonth === '2027-01' && !january.isBorgfactuur && !january.isAdvanceRent, 'january itself stays a normal rent invoice');

assert(
  !isLeaseEligibleForInvoiceMonth(trackLab, '2026-11', noInvoices),
  'not eligible two months before start'
);

const withJanuaryRent = [{ lease_id: 'lease-tracklab', invoice_month: '2027-01', notes: null }];
assert(
  !isLeaseEligibleForInvoiceMonth(trackLab, '2026-12', withJanuaryRent),
  'lead month blocked once the start-month rent invoice exists'
);
assert(
  !isLeaseEligibleForInvoiceMonth(trackLab, '2027-01', withJanuaryRent),
  'start month blocked once the rent invoice exists'
);

const depositOnly = [{ lease_id: 'lease-tracklab', invoice_month: '2027-01', notes: BORGFACTUUR_NOTES }];
assert(
  isLeaseEligibleForInvoiceMonth(trackLab, '2026-12', depositOnly),
  'a deposit invoice does not take the place of the January rent invoice'
);

const otherLeaseInvoice = [{ lease_id: 'lease-other', invoice_month: '2026-12' }];
assert(
  isLeaseEligibleForInvoiceMonth(trackLab, '2026-12', otherLeaseInvoice),
  'other lease invoices do not block TrackLab'
);

assert(isBorgfactuurNote('Borgfactuur'), 'exact borg note');
assert(isBorgfactuurNote('  Borgfactuur  '), 'trimmed borg note');
assert(isBorgfactuurNote(BORGFACTUUR_NOTES), 'deposit note with explanation still counts');
assert(!isBorgfactuurNote('Vergaderruimte boekingen:'), 'other notes are not borg');

const withDeposit = { ...trackLab, deposit_amount: 2000 };
const deposit = resolveDepositInvoice(withDeposit, '2026-12', noInvoices);
assert(deposit?.eligible && deposit.amount === 2000, 'deposit can be invoiced beside the advance rent');
assert(deposit?.isBorgfactuur && deposit.invoiceMonth === '2026-12', 'deposit keeps the month you pick');
assert(resolveDepositInvoice(trackLab, '2026-12', noInvoices) === null, 'no deposit invoice without an amount');
const novemberDeposit = resolveDepositInvoice(withDeposit, '2026-11', noInvoices);
assert(
  novemberDeposit?.eligible && novemberDeposit.invoiceMonth === '2026-11',
  'TrackLab deposit can be created in November, before the December rent'
);
assert(resolveDepositInvoice(withDeposit, '2026-12', depositOnly) === null, 'deposit is offered only once');

const existingTenant = {
  id: 'lease-existing',
  start_date: '2024-03-01',
  end_date: '2027-12-31',
  deposit_amount: 1500,
};
const existingInvoices = [
  { lease_id: 'lease-existing', invoice_month: '2026-11', notes: null },
  { lease_id: 'lease-existing', invoice_month: '2026-12', notes: null },
];
const existingDecember = resolveLeaseInvoiceTarget(existingTenant, '2026-12', existingInvoices);
assert(!existingDecember.eligible && !existingDecember.isAdvanceRent, 'an existing tenant is not invoiced twice for the same month');
const existingJanuary = resolveLeaseInvoiceTarget(existingTenant, '2027-01', existingInvoices);
assert(
  existingJanuary.eligible && existingJanuary.invoiceMonth === '2027-01' && !existingJanuary.isAdvanceRent && !existingJanuary.isBorgfactuur,
  'an existing tenant keeps a normal rent invoice in an open month'
);
const existingDeposit = resolveDepositInvoice(existingTenant, '2026-12', existingInvoices);
assert(
  existingDeposit?.eligible && existingDeposit.amount === 1500 && existingDeposit.isBorgfactuur && existingDeposit.invoiceMonth === '2026-12',
  'an existing tenant can get a deposit invoice after the rent invoice exists'
);

const anotherNewLease = {
  id: 'lease-new',
  start_date: '2026-06-15',
  end_date: '2028-06-14',
  deposit_amount: 500,
};
const anotherLead = resolveLeaseInvoiceTarget(anotherNewLease, '2026-05', noInvoices);
assert(
  anotherLead.eligible && anotherLead.isAdvanceRent && !anotherLead.isBorgfactuur && anotherLead.invoiceMonth === '2026-06',
  'every new lease is billed one month before it starts'
);
const anotherDeposit = resolveDepositInvoice(anotherNewLease, '2026-05', [
  ...depositOnly,
  { lease_id: 'lease-existing', invoice_month: '2026-06', notes: BORGFACTUUR_NOTES },
]);
assert(anotherDeposit?.eligible && anotherDeposit.amount === 500 && anotherDeposit.invoiceMonth === '2026-05', 'one tenant deposit never blocks another tenant');
assert(
  resolveDepositInvoice(anotherNewLease, '2026-04', noInvoices)?.invoiceMonth === '2026-04',
  'a deposit can be created before the first rent month'
);

console.log('leaseInvoiceEligibility tests passed');
