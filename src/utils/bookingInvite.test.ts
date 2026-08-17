import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBookingInvite, isPendingMeetingInvite } from './bookingInvite.ts';

test('formats a Dutch meeting-room invite message', () => {
  const text = formatBookingInvite({
    id: '1',
    booking_date: '2026-08-20',
    start_time: '09:00:00',
    end_time: '11:00:00',
    customerName: 'Acme BV',
    roomName: 'Spreekkamer 1',
  });
  assert.equal(text.title, 'Nieuwe spreekkamer aanvraag');
  assert.match(text.body, /Acme BV/);
  assert.match(text.body, /Spreekkamer 1/);
  assert.match(text.body, /09:00/);
  assert.match(text.body, /11:00/);
});

test('only pending meeting invites should pop up', () => {
  assert.equal(isPendingMeetingInvite({ status: 'pending' }), true);
  assert.equal(isPendingMeetingInvite({ status: 'confirmed' }), false);
  assert.equal(isPendingMeetingInvite({ status: 'cancelled' }), false);
  assert.equal(isPendingMeetingInvite({ status: 'pending', booking_type: 'flex_day' }), false);
});
