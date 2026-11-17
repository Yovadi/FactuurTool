import assert from 'node:assert/strict';
import { runsOnServer } from './serverJobTypes';

assert.equal(runsOnServer('generate_monthly_invoices'), true);
assert.equal(runsOnServer('generate_meeting_room_invoices'), true);
assert.equal(runsOnServer('check_expiring_leases'), true);
assert.equal(runsOnServer('send_invoice_reminders'), false);
assert.equal(runsOnServer('eboekhouden_payment_status_check'), false);
assert.equal(runsOnServer('generate_flex_invoices'), false);

console.log('serverJobs.test.ts ok');
