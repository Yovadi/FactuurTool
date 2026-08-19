import type { CompanySettings } from '../lib/supabase';

export async function syncBookingToOutlook(
  settings: CompanySettings,
  booking: {
    id: string;
    spaceName: string;
    date: string;
    startTime: string;
    endTime: string;
    customerName: string;
  }
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  if (!settings.calendar_sync_enabled) {
    return { success: false, error: 'Agenda-sync staat uit' };
  }
  if (!settings.graph_tenant_id || !settings.graph_client_id || !settings.graph_client_secret || !settings.graph_from_email) {
    return { success: false, error: 'Microsoft Graph is niet geconfigureerd' };
  }

  const tokenUrl = `https://login.microsoftonline.com/${settings.graph_tenant_id}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: settings.graph_client_id,
    client_secret: settings.graph_client_secret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    return { success: false, error: err.error_description || 'Outlook token ophalen mislukt' };
  }
  const tokenData = await tokenRes.json();

  const toDateTime = (date: string, time: string) => {
    const t = time.length >= 8 ? time.slice(0, 8) : `${time.slice(0, 5)}:00`;
    return `${date}T${t}`;
  };
  const start = toDateTime(booking.date, booking.startTime);
  const end = toDateTime(booking.date, booking.endTime);
  const eventRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(settings.graph_from_email)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: `Vergaderruimte ${booking.spaceName} — ${booking.customerName}`,
        body: { contentType: 'text', content: `Boeking ${booking.id}` },
        start: { dateTime: start, timeZone: 'Europe/Amsterdam' },
        end: { dateTime: end, timeZone: 'Europe/Amsterdam' },
        location: { displayName: booking.spaceName },
      }),
    }
  );

  if (!eventRes.ok) {
    const err = await eventRes.json().catch(() => ({}));
    return { success: false, error: err.error?.message || 'Outlook afspraak aanmaken mislukt (Calendars.ReadWrite nodig)' };
  }
  const event = await eventRes.json();
  return { success: true, eventId: event.id };
}
