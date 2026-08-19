export type BookingInvite = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  customerName: string;
  roomName: string;
};

export type MeetingBookingInsert = {
  id: string;
  status?: string | null;
  booking_type?: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  tenant_id?: string | null;
  external_customer_id?: string | null;
  space_id?: string | null;
};

function formatTime(value: string): string {
  return (value || '').slice(0, 5);
}

function formatDateNl(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatBookingInvite(invite: BookingInvite): { title: string; body: string } {
  return {
    title: 'Nieuwe spreekkamer aanvraag',
    body: `${invite.customerName} wil ${invite.roomName} op ${formatDateNl(invite.booking_date)} van ${formatTime(invite.start_time)} tot ${formatTime(invite.end_time)}.`,
  };
}

export function isPendingMeetingInvite(row: { status?: string | null; booking_type?: string | null }): boolean {
  if (row.status && row.status !== 'pending') return false;
  if (row.booking_type && row.booking_type === 'flex_day') return false;
  return true;
}
