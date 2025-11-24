import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type OfficeSpace = {
  id: string;
  space_number: string;
  space_type: string;
};

type PartTimeLease = {
  id: string;
  tenant_id: string;
  selected_days: string[];
  status: string;
  tenant: {
    company_name: string;
  };
  lease_spaces: {
    space_id: string;
  }[];
};

type SpaceAvailability = {
  space: OfficeSpace;
  availability: {
    [key: string]: {
      available: boolean;
      tenant?: string;
      leaseId?: string;
    };
  };
};

const DAYS = ['ma', 'di', 'wo', 'do', 'vr'];
const DAY_NAMES = {
  ma: 'Maandag',
  di: 'Dinsdag',
  wo: 'Woensdag',
  do: 'Donderdag',
  vr: 'Vrijdag',
};

export function PartTimeAvailability() {
  const [spaceAvailability, setSpaceAvailability] = useState<SpaceAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    setLoading(true);

    // Load all office spaces (excluding meeting rooms)
    const { data: spaces } = await supabase
      .from('office_spaces')
      .select('id, space_number, space_type')
      .neq('space_type', 'meeting_room')
      .order('space_number');

    // Load all active part-time leases
    const { data: partTimeLeases } = await supabase
      .from('leases')
      .select(`
        id,
        tenant_id,
        selected_days,
        status,
        tenant:tenants (company_name),
        lease_spaces (space_id)
      `)
      .eq('lease_type', 'part_time')
      .eq('status', 'active');

    if (spaces && partTimeLeases) {
      const availability: SpaceAvailability[] = spaces.map((space) => {
        const spaceAvailability: SpaceAvailability = {
          space,
          availability: {},
        };

        // Initialize all days as available
        DAYS.forEach((day) => {
          spaceAvailability.availability[day] = { available: true };
        });

        // Mark occupied days
        partTimeLeases.forEach((lease: any) => {
          const isSpaceInLease = lease.lease_spaces.some(
            (ls: any) => ls.space_id === space.id
          );

          if (isSpaceInLease && lease.selected_days) {
            lease.selected_days.forEach((day: string) => {
              spaceAvailability.availability[day] = {
                available: false,
                tenant: lease.tenant?.company_name,
                leaseId: lease.id,
              };
            });
          }
        });

        return spaceAvailability;
      });

      setSpaceAvailability(availability);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-dark-900 rounded-lg p-8 text-center">
        <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400">Laden...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-dark-700 rounded-lg">
            <Calendar className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-100">Deeltijd Beschikbaarheid</h2>
            <p className="text-gray-400 text-sm">Overzicht van beschikbare dagen per kantoorruimte</p>
          </div>
        </div>
      </div>

      <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-dark-800 border-b border-dark-700">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-100">
                  Ruimte
                </th>
                {DAYS.map((day) => (
                  <th key={day} className="px-4 py-3 text-center text-sm font-semibold text-gray-100">
                    {DAY_NAMES[day as keyof typeof DAY_NAMES]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {spaceAvailability.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <div className="flex flex-col items-center">
                      <AlertCircle size={48} className="text-gray-500 mb-4" />
                      <p className="text-gray-400">Geen kantoorruimtes gevonden</p>
                    </div>
                  </td>
                </tr>
              ) : (
                spaceAvailability.map((spaceAvail) => (
                  <tr key={spaceAvail.space.id} className="hover:bg-dark-800/50 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium text-gray-100">
                          {spaceAvail.space.space_number}
                        </div>
                        <div className="text-xs text-gray-400 capitalize">
                          {spaceAvail.space.space_type.replace('_', ' ')}
                        </div>
                      </div>
                    </td>
                    {DAYS.map((day) => {
                      const dayInfo = spaceAvail.availability[day];
                      return (
                        <td key={day} className="px-4 py-4 text-center">
                          {dayInfo.available ? (
                            <div className="flex flex-col items-center gap-1">
                              <CheckCircle size={24} className="text-green-500" />
                              <span className="text-xs text-green-400 font-medium">Vrij</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <XCircle size={24} className="text-red-500" />
                              <span className="text-xs text-red-400 font-medium">Bezet</span>
                              {dayInfo.tenant && (
                                <span className="text-xs text-gray-400 max-w-[100px] truncate" title={dayInfo.tenant}>
                                  {dayInfo.tenant}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-4">
        <h3 className="text-sm font-semibold text-gray-100 mb-3">Legenda</h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500" />
            <span className="text-sm text-gray-400">Beschikbaar voor deeltijd verhuur</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle size={20} className="text-red-500" />
            <span className="text-sm text-gray-400">Bezet door bestaand deeltijd contract</span>
          </div>
        </div>
      </div>
    </div>
  );
}
