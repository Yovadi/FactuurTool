import { supabase } from '../lib/supabase';
import { getCurrentDateString } from './dateHelpers';
import { createLeaseNotification } from './notificationHelper';
import { pendingIndexation, type IndexationLease, type IndexationPreview } from './rentIndexation';

function tenantName(row: { tenant?: { company_name?: string } | { company_name?: string }[] | null }): string {
  const tenant = Array.isArray(row.tenant) ? row.tenant[0] : row.tenant;
  return tenant?.company_name || 'Onbekende huurder';
}

async function loadLeases(): Promise<IndexationLease[]> {
  const { data, error } = await supabase
    .from('leases')
    .select('id, tenant_id, last_indexation_at, tenant:tenants(company_name), lease_spaces(id, monthly_rent, price_per_sqm)')
    .eq('status', 'active')
    .eq('lease_type', 'full_time');

  if (error || !data) return [];

  return (data as any[]).map((lease) => ({
    id: lease.id,
    tenant_id: lease.tenant_id,
    tenantName: tenantName(lease),
    last_indexation_at: lease.last_indexation_at,
    spaces: (lease.lease_spaces || []).map((space: any) => ({
      id: space.id,
      monthly_rent: Number(space.monthly_rent) || 0,
      price_per_sqm: Number(space.price_per_sqm) || 0,
    })),
  }));
}

export async function loadIndexationPreview(percentage: number): Promise<IndexationPreview[]> {
  const today = await getCurrentDateString();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return pendingIndexation(await loadLeases(), percentage, yearStart);
}

export async function applyPendingIndexation(percentage: number): Promise<number> {
  const today = await getCurrentDateString();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const pending = pendingIndexation(await loadLeases(), percentage, yearStart);

  for (const lease of pending) {
    for (const line of lease.lines) {
      const { error } = await supabase
        .from('lease_spaces')
        .update({ monthly_rent: line.newRent, price_per_sqm: line.newRate })
        .eq('id', line.id);
      if (error) throw error;
    }

    const { error: leaseError } = await supabase
      .from('leases')
      .update({ last_indexation_at: today })
      .eq('id', lease.leaseId);
    if (leaseError) throw leaseError;

    await createLeaseNotification(
      'rent_indexation_applied',
      lease.leaseId,
      lease.tenantName,
      `${percentage}% verhoging: €${lease.totalOld.toFixed(2)} → €${lease.totalNew.toFixed(2)}/maand`,
      lease.tenantId || undefined
    );
  }

  return pending.length;
}
