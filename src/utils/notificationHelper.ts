import { supabase } from '../lib/supabase';

type BookingType = 'meeting_room' | 'flex_workspace';

export async function createAdminNotification(
  type: 'booking_cancelled' | 'booking_pending',
  bookingType: BookingType,
  bookingId: string,
  customerName: string,
  bookingDetails: string,
  tenantId?: string,
  externalCustomerId?: string
): Promise<void> {
  const titles: Record<string, string> = {
    'booking_cancelled': 'Boeking Geannuleerd',
    'booking_pending': 'Nieuwe Boeking In Afwachting'
  };

  const messages: Record<string, string> = {
    'booking_cancelled': `${customerName} heeft een boeking geannuleerd: ${bookingDetails}`,
    'booking_pending': `${customerName} heeft een nieuwe boeking aangevraagd: ${bookingDetails}`
  };

  try {
    const { error } = await supabase.from('admin_notifications').insert({
      notification_type: type,
      title: titles[type],
      message: messages[type],
      booking_type: bookingType,
      booking_id: bookingId,
      tenant_id: tenantId || null,
      external_customer_id: externalCustomerId || null,
      is_read: false
    });

    if (error) {
      console.error('Error creating admin notification:', error);
    }
  } catch (err) {
    console.error('Failed to create admin notification:', err);
  }
}
