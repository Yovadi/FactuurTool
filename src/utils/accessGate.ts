/** Who may touch which table once the public database key is closed. */

export type AccessRole = 'anon' | 'staff' | 'booker';
export type AccessAction = 'select' | 'insert' | 'update' | 'delete';

export const SECRET_TABLES = ['access_gate_secrets', 'booker_credentials', 'pin_attempts'] as const;

const BOOKER_SELECT = new Set([
  'office_spaces',
  'meeting_room_bookings',
  'recurring_booking_patterns',
  'booking_waiting_list',
]);

export type AccessRow = {
  space_type?: string | null;
  tenant_id?: string | null;
  external_customer_id?: string | null;
};

export function allows(
  role: AccessRole,
  table: string,
  action: AccessAction,
  row: AccessRow = {},
  customerId: string | null = null,
): boolean {
  if ((SECRET_TABLES as readonly string[]).includes(table)) return false;
  if (role === 'anon') return false;
  if (role === 'staff') return true;
  if (role !== 'booker' || !customerId) return false;

  const ownTenant = row.tenant_id === customerId && !row.external_customer_id;
  const ownExternal = row.external_customer_id === customerId && !row.tenant_id;

  if (table === 'office_spaces' && action === 'select') {
    return !row.space_type || row.space_type === 'Meeting Room';
  }
  if (table === 'meeting_room_bookings' && action === 'select') return true;
  if (table === 'meeting_room_bookings' && (action === 'insert' || action === 'update')) {
    return ownTenant || ownExternal;
  }
  if (table === 'recurring_booking_patterns' && (action === 'select' || action === 'insert')) {
    return row.tenant_id === customerId;
  }
  if (table === 'booking_waiting_list' && action === 'insert') {
    return ownTenant || ownExternal;
  }
  if ((table === 'tenants' || table === 'external_customers') && action === 'select') {
    return false;
  }
  if (BOOKER_SELECT.has(table)) return false;
  return false;
}

export function bookingLabel(input: {
  tenantId?: string | null;
  externalCustomerId?: string | null;
  tenantName?: string | null;
  externalName?: string | null;
  userType?: 'tenant' | 'external' | null;
  userId?: string | null;
  userName?: string | null;
}): string {
  const own = input.userId && (
    (input.userType === 'tenant' && input.tenantId === input.userId)
    || (input.userType === 'external' && input.externalCustomerId === input.userId)
  );
  if (own && input.userName) return input.userName;
  const visible = input.tenantName || input.externalName;
  if (visible) return visible;
  return 'Bezet';
}

export function roleFromAccessToken(token: string): AccessRole | '' {
  const part = token.split('.')[1];
  if (!part) return '';
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '=')));
    const role = json?.app_metadata?.app_role;
    if (role === 'staff' || role === 'booker') return role;
    return '';
  } catch {
    return '';
  }
}

export function interpretGateResponse(status: number): 'session' | 'rejected' | 'legacy' | 'error' {
  if (status === 200) return 'session';
  if (status === 401 || status === 429) return 'rejected';
  // A missing or broken function keeps the current PIN check until the database is closed.
  if (status === 404 || status === 500 || status === 503) return 'legacy';
  return 'error';
}

export async function requestGate(
  url: string,
  anonKey: string,
  functionName: 'staff-session' | 'booker-session',
  pin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ kind: ReturnType<typeof interpretGateResponse>; accessToken?: string; refreshToken?: string; profile?: GateProfile; message?: string }> {
  let response: Response;
  try {
    response = await fetchImpl(`${url.replace(/\/$/, '')}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ pin }),
    });
  } catch {
    return { kind: 'legacy' };
  }
  const kind = interpretGateResponse(response.status);
  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  if (kind !== 'session') {
    return { kind, message: typeof body.error === 'string' ? body.error : undefined };
  }
  return {
    kind,
    accessToken: typeof body.access_token === 'string' ? body.access_token : undefined,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
    profile: body.profile as GateProfile | undefined,
  };
}

export function pinAttemptBlocked(failuresInWindow: number, limit = 8): boolean {
  return failuresInWindow >= limit;
}

export function gateReady(staffReady: boolean, bookingReady: boolean): boolean {
  return staffReady === true && bookingReady === true;
}

/** Open only with a staff session, or while the settings row is still readable and no PIN is set. */
export function staffLockDecision(input: {
  hasStaffSession: boolean;
  settingsVisible: boolean;
  pin: string | null;
  remembered: boolean;
}): 'open' | 'ask' {
  if (input.hasStaffSession) return 'open';
  if (!input.settingsVisible) return 'ask';
  if (!input.pin || input.remembered) return 'open';
  return 'ask';
}

export function ownBookingRow(
  userType: 'tenant' | 'external',
  customerId: string,
): { tenant_id: string | null; external_customer_id: string | null } {
  if (userType === 'tenant') return { tenant_id: customerId, external_customer_id: null };
  return { tenant_id: null, external_customer_id: customerId };
}

export type GateProfile = {
  id: string;
  userType: 'tenant' | 'external';
  name?: string;
  company_name?: string;
  meeting_discount_percentage?: number;
};

export function bookerProfile(row: {
  id: string;
  userType: 'tenant' | 'external';
  name?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  meeting_discount_percentage?: number | null;
  booking_pin_code?: string | null;
}): GateProfile {
  return {
    id: row.id,
    userType: row.userType,
    name: row.name || row.contact_name || undefined,
    company_name: row.company_name || undefined,
    meeting_discount_percentage: Number(row.meeting_discount_percentage) || 0,
  };
}
