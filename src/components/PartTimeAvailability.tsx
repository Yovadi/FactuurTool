import { useState, useEffect } from 'react';
import { supabase, type Tenant } from '../lib/supabase';
import { Calendar, CheckCircle, XCircle, AlertCircle, Users, Plus, Edit2, Trash2, Mail, Phone, MapPin, Key, Building2 } from 'lucide-react';

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

type TenantWithLeases = Tenant & {
  leases?: Array<{
    id: string;
    status: string;
    lease_type?: string;
  }>;
};

export function PartTimeAvailability() {
  const [activeTab, setActiveTab] = useState<'availability' | 'tenants'>('tenants');
  const [spaceAvailability, setSpaceAvailability] = useState<SpaceAvailability[]>([]);
  const [tenants, setTenants] = useState<TenantWithLeases[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvailability();
    loadTenants();
  }, []);

  const loadTenants = async () => {
    const { data, error } = await supabase
      .from('tenants')
      .select(`
        *,
        leases (
          id,
          status,
          lease_type
        )
      `)
      .order('company_name');

    if (data) {
      setTenants(data);
    }
  };

  const loadAvailability = async () => {
    setLoading(true);

    // Load only offices and consultation rooms
    const { data: spaces } = await supabase
      .from('office_spaces')
      .select('id, space_number, space_type')
      .in('space_type', ['kantoor', 'spreekkamer'])
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

  const partTimeTenants = tenants.filter(tenant =>
    tenant.leases &&
    tenant.leases.some(lease =>
      lease.status === 'active' &&
      lease.lease_type === 'parttime'
    )
  );

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'tenants'
              ? 'bg-gold-500 text-dark-950'
              : 'text-gray-300 hover:bg-dark-800'
          }`}
        >
          <Users size={18} />
          Deeltijd Huurders
        </button>
        <button
          onClick={() => setActiveTab('availability')}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'availability'
              ? 'bg-gold-500 text-dark-950'
              : 'text-gray-300 hover:bg-dark-800'
          }`}
        >
          <Calendar size={18} />
          Beschikbaarheid
        </button>
      </div>

      {activeTab === 'tenants' ? (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-dark-800 border-b border-amber-500">
            <h2 className="text-lg font-bold text-gray-100">
              Deeltijd Huurders
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                  <th className="text-left px-4 py-3 font-semibold w-[20%]">Bedrijf</th>
                  <th className="text-left px-4 py-3 font-semibold w-[15%]">Contactpersoon</th>
                  <th className="text-left px-4 py-3 font-semibold w-[18%]">Email</th>
                  <th className="text-left px-4 py-3 font-semibold w-[12%]">Telefoon</th>
                  <th className="text-left px-4 py-3 font-semibold w-[18%]">Adres</th>
                  <th className="text-center px-4 py-3 font-semibold w-[8%]">PIN</th>
                </tr>
              </thead>
              <tbody>
                {partTimeTenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={18} className="text-gray-400" />
                        <span className="font-medium text-gray-100 truncate">{tenant.company_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 truncate">
                      <span className="text-gray-300 truncate">{tenant.name || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {tenant.email ? (
                        <a
                          href={`mailto:${tenant.email}`}
                          className="text-gold-500 hover:text-gold-400 flex items-center gap-2 truncate"
                        >
                          <Mail size={16} />
                          <span className="truncate">{tenant.email}</span>
                        </a>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {tenant.phone ? (
                        <a
                          href={`tel:${tenant.phone}`}
                          className="text-gold-500 hover:text-gold-400 flex items-center gap-2 truncate"
                        >
                          <Phone size={16} />
                          <span className="truncate">{tenant.phone}</span>
                        </a>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 truncate">
                        <MapPin size={16} className="text-gray-400 flex-shrink-0" />
                        <span className="text-gray-300 text-sm truncate">
                          {tenant.street}, {tenant.city}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tenant.booking_pin_code ? (
                        <div className="flex items-center justify-center gap-1">
                          <Key size={16} className="text-gold-500" />
                          <span className="text-gray-300 font-mono">{tenant.booking_pin_code}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {partTimeTenants.length === 0 && (
            <div className="bg-dark-900 p-8 text-center">
              <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Geen deeltijd huurders gevonden</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-800 border-b border-dark-700">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    Ruimte
                  </th>
                  {DAYS.map((day) => (
                    <th key={day} className="px-2 py-2 text-center text-xs font-semibold text-gray-300 uppercase tracking-wide">
                      {day.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
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
                    <tr key={spaceAvail.space.id} className="border-b border-dark-800 hover:bg-dark-800 transition-colors">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-100 text-sm">
                          {spaceAvail.space.space_number}
                        </div>
                      </td>
                      {DAYS.map((day) => {
                        const dayInfo = spaceAvail.availability[day];
                        return (
                          <td key={day} className={`px-2 py-2 text-center ${dayInfo.available ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            {dayInfo.available ? (
                              <div className="flex items-center justify-center">
                                <CheckCircle size={18} className="text-green-500" />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <XCircle size={18} className="text-red-500" />
                                {dayInfo.tenant && (
                                  <span className="text-[10px] text-gray-500 max-w-[80px] truncate leading-tight" title={dayInfo.tenant}>
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

          <div className="px-4 py-3 bg-dark-800 border-t border-dark-700 flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" />
              <span className="text-gray-400">Beschikbaar</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-red-500" />
              <span className="text-gray-400">Bezet</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
