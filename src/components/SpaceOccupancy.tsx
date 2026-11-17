import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentDateString } from '../utils/dateHelpers';
import { addCalendarDays } from '../utils/amsterdamCalendar';
import { Building2 } from 'lucide-react';
import { SkeletonTable } from './SkeletonLoader';

type OccupancyRow = {
  id: string;
  spaceNumber: string;
  spaceType: string;
  squareFootage: number | null;
  tenantName: string | null;
  startDate: string | null;
  endDate: string | null;
  endingSoon: boolean;
  future: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  bedrijfsruimte: 'Bedrijfsruimte',
  kantoor: 'Kantoor',
  buitenterrein: 'Buitenterrein',
  diversen: 'Diversen',
  'Meeting Room': 'Vergaderruimte',
};

function formatIso(iso: string | null): string {
  if (!iso) return 'onbepaald';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}-${month}-${year}`;
}

export function SpaceOccupancy() {
  const [rows, setRows] = useState<OccupancyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = await getCurrentDateString();
      const soon = addCalendarDays(today, 90);
      const [{ data: spaces }, { data: leases }] = await Promise.all([
        supabase.from('office_spaces').select('id, space_number, space_type, square_footage').order('space_number'),
        supabase
          .from('leases')
          .select('start_date, end_date, status, tenant:tenants(company_name), lease_spaces(space_id)')
          .eq('status', 'active'),
      ]);

      const currentBySpace = new Map<string, { tenantName: string; startDate: string; endDate: string | null }>();
      const futureBySpace = new Map<string, { tenantName: string; startDate: string; endDate: string | null }>();
      for (const lease of (leases || []) as any[]) {
        const start = String(lease.start_date || '').slice(0, 10);
        const end = lease.end_date ? String(lease.end_date).slice(0, 10) : null;
        if (end && end < today) continue;
        const tenant = Array.isArray(lease.tenant) ? lease.tenant[0] : lease.tenant;
        const name = tenant?.company_name || 'Onbekende huurder';
        const target = start && start > today ? futureBySpace : currentBySpace;
        for (const link of lease.lease_spaces || []) {
          const current = target.get(link.space_id);
          const rank = start || '0000-01-01';
          const currentRank = current?.startDate || '9999-12-31';
          const keepFuture = target === futureBySpace ? rank < currentRank : (end || '9999-12-31') > (current?.endDate || '9999-12-31');
          if (!current || keepFuture) {
            target.set(link.space_id, { tenantName: name, startDate: start, endDate: end });
          }
        }
      }

      setRows(
        ((spaces || []) as any[]).map((space) => {
          const occupied = currentBySpace.get(space.id) || futureBySpace.get(space.id) || null;
          const future = !currentBySpace.has(space.id) && futureBySpace.has(space.id);
          return {
            id: space.id,
            spaceNumber: space.space_number,
            spaceType: TYPE_LABELS[space.space_type] || space.space_type,
            squareFootage: space.square_footage,
            tenantName: occupied?.tenantName || null,
            startDate: occupied?.startDate || null,
            endDate: occupied?.endDate || null,
            endingSoon: Boolean(!future && occupied?.endDate && occupied.endDate <= soon),
            future,
          };
        })
      );
      setLoading(false);
    };
    load();
  }, []);

  const letCount = rows.filter((row) => row.tenantName && !row.future).length;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Bezetting</h1>
          <p className="text-sm text-gray-400 mt-1">
            {letCount} van {rows.length} ruimtes verhuurd
          </p>
        </div>
      </div>

      {loading ? (
        <SkeletonTable />
      ) : (
        <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-dark-800 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Ruimte</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-right px-4 py-3 font-medium">m²</th>
                <th className="text-left px-4 py-3 font-medium">Huurder</th>
                <th className="text-left px-4 py-3 font-medium">Van</th>
                <th className="text-left px-4 py-3 font-medium">Tot</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-dark-800">
                  <td className="px-4 py-3 text-gray-100 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Building2 size={14} className="text-gray-500" />
                      {row.spaceNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{row.spaceType}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{row.squareFootage ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-100">{row.tenantName || '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{row.tenantName ? formatIso(row.startDate) : '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{row.tenantName ? formatIso(row.endDate) : '—'}</td>
                  <td className="px-4 py-3">
                    {row.tenantName ? (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${row.future || row.endingSoon ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                        {row.future ? `Vanaf ${formatIso(row.startDate)}` : row.endingSoon ? `Vrij per ${formatIso(row.endDate)}` : 'Verhuurd'}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-dark-700 text-gray-300">
                        {row.spaceType === 'Vergaderruimte' ? 'Geen vast contract' : 'Vrij'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
