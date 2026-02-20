import { supabase } from '../lib/supabase';

type BookingNotificationType = 'booking_cancelled' | 'booking_pending';
type LeaseNotificationType = 'lease_expiring_30' | 'lease_expiring_60' | 'rent_indexation_applied';
type NotificationType = BookingNotificationType | LeaseNotificationType;
type BookingType = 'meeting_room' | 'flex_workspace';

export async function createAdminNotification(
  type: BookingNotificationType,
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

export async function createLeaseNotification(
  type: LeaseNotificationType,
  leaseId: string,
  tenantName: string,
  details: string,
  tenantId?: string
): Promise<void> {
  const titles: Record<LeaseNotificationType, string> = {
    'lease_expiring_30': 'Contract verloopt binnen 30 dagen',
    'lease_expiring_60': 'Contract verloopt binnen 60 dagen',
    'rent_indexation_applied': 'Huurprijsverhoging doorgevoerd'
  };

  const messages: Record<LeaseNotificationType, string> = {
    'lease_expiring_30': `Contract van ${tenantName} verloopt binnenkort: ${details}`,
    'lease_expiring_60': `Contract van ${tenantName} verloopt over ca. 2 maanden: ${details}`,
    'rent_indexation_applied': `Huurprijs van ${tenantName} is verhoogd: ${details}`
  };

  try {
    const { error } = await supabase.from('admin_notifications').insert({
      notification_type: type,
      title: titles[type],
      message: messages[type],
      booking_type: null,
      booking_id: null,
      tenant_id: tenantId || null,
      external_customer_id: null,
      is_read: false
    });

    if (error) {
      console.error('Error creating lease notification:', error);
    }
  } catch (err) {
    console.error('Failed to create lease notification:', err);
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count } = await supabase
    .from('admin_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);
  return count ?? 0;
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase
    .from('admin_notifications')
    .update({ is_read: true })
    .eq('is_read', false);
}

export async function deleteReadNotifications(): Promise<void> {
  await supabase
    .from('admin_notifications')
    .delete()
    .eq('is_read', true);
}

export async function deleteNotification(id: string): Promise<void> {
  await supabase
    .from('admin_notifications')
    .delete()
    .eq('id', id);
}
