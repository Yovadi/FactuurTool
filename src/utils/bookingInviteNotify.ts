import { supabase } from '../lib/supabase';
import {
  formatBookingInvite,
  isPendingMeetingInvite,
  type BookingInvite,
  type MeetingBookingInsert,
} from './bookingInvite';

export async function loadBookingInviteDetails(row: MeetingBookingInsert): Promise<BookingInvite | null> {
  if (!isPendingMeetingInvite(row)) return null;

  let customerName = 'Onbekende klant';
  if (row.tenant_id) {
    const { data } = await supabase
      .from('tenants')
      .select('company_name, name')
      .eq('id', row.tenant_id)
      .maybeSingle();
    customerName = data?.company_name || data?.name || customerName;
  } else if (row.external_customer_id) {
    const { data } = await supabase
      .from('external_customers')
      .select('company_name, contact_name')
      .eq('id', row.external_customer_id)
      .maybeSingle();
    customerName = data?.company_name || data?.contact_name || customerName;
  }

  let roomName = 'spreekkamer';
  if (row.space_id) {
    const { data } = await supabase
      .from('office_spaces')
      .select('space_number')
      .eq('id', row.space_id)
      .maybeSingle();
    if (data?.space_number) roomName = data.space_number;
  }

  return {
    id: row.id,
    booking_date: row.booking_date,
    start_time: row.start_time,
    end_time: row.end_time,
    customerName,
    roomName,
  };
}

export function notifyBookingInviteDesktop(title: string, body: string): void {
  const electronNotify = window.electron?.showBookingNotification;
  if (electronNotify) {
    void electronNotify({ title, body });
    return;
  }

  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
    return;
  }
  if (Notification.permission !== 'denied') {
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') new Notification(title, { body });
    });
  }
}

export { formatBookingInvite };
