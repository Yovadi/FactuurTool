import assert from 'node:assert/strict';
import { businessDate, businessInstant, businessMonth, businessMonthRange } from './businessClock';
import { amsterdamCalendar } from './amsterdamCalendar';

const justAfterMidnightAmsterdam = new Date('2026-11-30T23:30:00Z');
assert.equal(businessDate(false, null, justAfterMidnightAmsterdam), '2026-12-01');
assert.equal(businessDate(true, '2026-03-15', justAfterMidnightAmsterdam), '2026-03-15');
assert.equal(businessDate(true, '2026-03-15T00:00:00Z', justAfterMidnightAmsterdam), '2026-03-15');
assert.equal(businessDate(false, '2026-03-15', justAfterMidnightAmsterdam), '2026-12-01');

const noon = businessInstant('2026-12-01');
assert.equal(amsterdamCalendar(noon).date, '2026-12-01');

assert.equal(businessMonth('2026-02-15').end, '2026-02-28');
assert.equal(businessMonth('2024-02-15').end, '2024-02-29');
assert.equal(businessMonth('2026-12-01').start, '2026-12-01');
const december = businessMonthRange('2026-12-15');
assert.equal(amsterdamCalendar(new Date(december.start)).date, '2026-12-01');
assert.equal(amsterdamCalendar(new Date(december.end)).date, '2026-12-31');

console.log('businessClock.test.ts ok');
