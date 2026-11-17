import assert from 'node:assert/strict';
import { openInvoiceAmount } from './invoiceBalance';
import { pendingIndexation } from './rentIndexation';

const preview = pendingIndexation(
  [
    {
      id: 'lease-1',
      tenantName: 'TrackLab',
      last_indexation_at: null,
      spaces: [{ id: 'a', monthly_rent: 1000, price_per_sqm: 10 }],
    },
    {
      id: 'lease-2',
      tenantName: 'Al gedaan',
      last_indexation_at: '2026-01-02',
      spaces: [{ id: 'b', monthly_rent: 500, price_per_sqm: 5 }],
    },
  ],
  3,
  '2026-01-01'
);

assert.equal(preview.length, 1);
assert.equal(preview[0].tenantName, 'TrackLab');
assert.equal(preview[0].totalOld, 1000);
assert.equal(preview[0].totalNew, 1030);
assert.equal(preview[0].lines[0].newRate, 10.3);
assert.equal(openInvoiceAmount(1000, 200, 300), 500);
assert.equal(openInvoiceAmount(100, 80, 30), 0);

console.log('rentIndexation.test.ts ok');
