import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allows,
  bookerProfile,
  bookingLabel,
  gateReady,
  interpretGateResponse,
  ownBookingRow,
  pinAttemptBlocked,
  requestGate,
  roleFromAccessToken,
} from './accessGate.ts';

const customer = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';

function token(role: string, customerId?: string): string {
  const payload = Buffer.from(JSON.stringify({
    app_metadata: { app_role: role, customer_id: customerId },
    role: 'authenticated',
  })).toString('base64url');
  return `aaa.${payload}.sig`;
}

assert.equal(allows('anon', 'invoices', 'select'), false);
assert.equal(allows('anon', 'company_settings', 'select'), false);
assert.equal(allows('anon', 'tenants', 'select'), false);
assert.equal(allows('anon', 'access_gate_secrets', 'select'), false);

assert.equal(allows('staff', 'invoices', 'delete'), true);
assert.equal(allows('staff', 'company_settings', 'update'), true);
assert.equal(allows('staff', 'wifi_networks', 'select'), true);
assert.equal(allows('staff', 'access_gate_secrets', 'select'), false);
assert.equal(allows('staff', 'booker_credentials', 'select'), false);
assert.equal(allows('staff', 'pin_attempts', 'select'), false);

assert.equal(allows('booker', 'invoices', 'select', {}, customer), false);
assert.equal(allows('booker', 'company_settings', 'select', {}, customer), false);
assert.equal(allows('booker', 'tenants', 'select', {}, customer), false);
assert.equal(allows('booker', 'wifi_networks', 'select', {}, customer), false);
assert.equal(allows('booker', 'office_spaces', 'select', { space_type: 'Meeting Room' }, customer), true);
assert.equal(allows('booker', 'office_spaces', 'select', { space_type: 'kantoor' }, customer), false);
assert.equal(allows('booker', 'office_spaces', 'update', { space_type: 'Meeting Room' }, customer), false);
assert.equal(allows('booker', 'meeting_room_bookings', 'select', {}, customer), true);
assert.equal(allows('booker', 'meeting_room_bookings', 'insert', { tenant_id: customer, external_customer_id: null }, customer), true);
assert.equal(allows('booker', 'meeting_room_bookings', 'insert', { tenant_id: other, external_customer_id: null }, customer), false);
assert.equal(allows('booker', 'meeting_room_bookings', 'update', { tenant_id: null, external_customer_id: customer }, customer), true);
assert.equal(allows('booker', 'meeting_room_bookings', 'delete', { tenant_id: customer }, customer), false);
assert.equal(allows('booker', 'recurring_booking_patterns', 'insert', { tenant_id: customer }, customer), true);
assert.equal(allows('booker', 'recurring_booking_patterns', 'insert', { tenant_id: other }, customer), false);
assert.equal(allows('booker', 'booking_waiting_list', 'insert', { tenant_id: null, external_customer_id: customer }, customer), true);
assert.equal(allows('booker', 'booking_waiting_list', 'select', {}, customer), false);

assert.equal(bookingLabel({
  tenantId: other,
  userType: 'tenant',
  userId: customer,
  userName: 'TrackLab',
}), 'Bezet');
assert.equal(bookingLabel({
  tenantId: customer,
  userType: 'tenant',
  userId: customer,
  userName: 'TrackLab',
}), 'TrackLab');
assert.equal(bookingLabel({
  tenantId: other,
  tenantName: 'Andere BV',
  userType: 'tenant',
  userId: customer,
}), 'Andere BV');

assert.equal(roleFromAccessToken(token('staff')), 'staff');
assert.equal(roleFromAccessToken(token('booker', customer)), 'booker');
assert.equal(roleFromAccessToken('nope'), '');
assert.equal(roleFromAccessToken('a.%%% .b'), '');

assert.equal(interpretGateResponse(200), 'session');
assert.equal(interpretGateResponse(401), 'rejected');
assert.equal(interpretGateResponse(429), 'rejected');
assert.equal(interpretGateResponse(404), 'legacy');
assert.equal(interpretGateResponse(503), 'legacy');
assert.equal(interpretGateResponse(500), 'legacy');
assert.equal(interpretGateResponse(400), 'error');

assert.equal(pinAttemptBlocked(7), false);
assert.equal(pinAttemptBlocked(8), true);
assert.equal(gateReady(true, false), false);
assert.equal(gateReady(true, true), true);

const own = ownBookingRow('tenant', customer);
assert.equal(own.tenant_id, customer);
assert.equal(own.external_customer_id, null);
const profile = bookerProfile({
  id: customer,
  userType: 'tenant',
  company_name: 'TrackLab',
  meeting_discount_percentage: 10,
  booking_pin_code: '1234',
});
assert.equal(profile.company_name, 'TrackLab');
assert.equal('booking_pin_code' in profile, false);

const asFetch = (response: Response) => (() => Promise.resolve(response)) as typeof fetch;

requestGate('https://example.test', 'anon', 'staff-session', '1234', asFetch(new Response(JSON.stringify({ error: 'Onjuiste personeels-PIN' }), { status: 401 })))
  .then((rejected) => {
    assert.equal(rejected.kind, 'rejected');
    assert.equal(rejected.accessToken, undefined);
    return requestGate('https://example.test', 'anon', 'booker-session', '1234', asFetch(new Response('missing', { status: 404 })));
  })
  .then((missing) => {
    assert.equal(missing.kind, 'legacy');
    return requestGate('https://example.test', 'anon', 'booker-session', '1234', asFetch(new Response(JSON.stringify({
      access_token: token('booker', customer),
      refresh_token: 'refresh',
      profile,
    }), { status: 200 })));
  })
  .then((opened) => {
    assert.equal(opened.kind, 'session');
    assert.equal(roleFromAccessToken(opened.accessToken || ''), 'booker');
    assert.equal(opened.profile?.id, customer);
    console.log('accessGate.test.ts ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

const safeSql = readFileSync(new URL('../../supabase/migrations/20261118010000_access_gate_tables.sql', import.meta.url), 'utf8');
const lockSql = readFileSync(new URL('../../supabase/migrations/20261118020000_close_anon_access.sql', import.meta.url), 'utf8');
assert.match(safeSql, /access_gate_secrets/);
assert.match(safeSql, /ENABLE ROW LEVEL SECURITY/);
assert.doesNotMatch(safeSql, /CREATE POLICY/);
assert.match(lockSql, /staff_gate_ready/);
assert.match(lockSql, /booking_gate_ready/);
assert.ok(lockSql.indexOf('RAISE EXCEPTION') < lockSql.indexOf('DROP POLICY'), 'the lock stops before it drops anything');
for (const table of ['access_gate_secrets', 'booker_credentials', 'pin_attempts']) {
  assert.match(lockSql, new RegExp(table));
}
assert.match(lockSql, /Staff full access/);
assert.match(lockSql, /''staff''/);
assert.match(lockSql, /Meeting Room/);

const bookingPage = readFileSync(new URL('../../public/booking.html', import.meta.url), 'utf8');
const ownAt = bookingPage.indexOf('const isOwnBooking');
const labelAt = bookingPage.indexOf('const displayName = isOwnBooking');
assert.ok(ownAt > 0 && labelAt > ownAt, 'the calendar decides ownership before the label');
assert.match(bookingPage, /status === 401 && !clearOnFail\) return/);
assert.match(bookingPage, /functions\/v1\/booker-session/);
assert.match(bookingPage, /Bezet/);
assert.equal(bookingPage.includes('tenants(name, company_name)'), false);
