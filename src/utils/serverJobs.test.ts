import assert from 'node:assert/strict';
import { runsOnServer } from './serverJobTypes';

assert.equal(runsOnServer('generate_monthly_invoices'), true);
assert.equal(runsOnServer('generate_meeting_room_invoices'), true);
assert.equal(runsOnServer('check_expiring_leases'), true);
assert.equal(runsOnServer('settings_backup'), true);

console.log('serverJobs.test.ts ok');
