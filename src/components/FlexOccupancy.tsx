import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Calendar, Save, X, Plus, Trash2, Check, Building2, Mail, Phone, Euro, CreditCard, CalendarDays } from 'lucide-react';
import FlexDayBooking from './FlexDayBooking';

type Space = {
  id: string;
  space_number: string;
  space_type: string;
  square_footage: number | null;
  is_available: boolean;
  is_flex_space: boolean;
  flex_capacity: number | null;
  furnished: boolean;
};

type Tenant = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  postal_code: string;
  city: string;
};

type Lease = {
  id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  status: string;
  lease_type: 'full_time' | 'flex';
  security_deposit: number;
  vat_rate: number;
  flex_credits_per_month: number | null;
  flex_credit_rate: number | null;
  flex_day_type: 'full_day' | 'half_day' | null;
  tenants: Tenant;
  lease_spaces?: LeaseSpace[];
};

type LeaseSpace = {
  id: string;
  lease_id: string;
  space_id: string;
  price_per_sqm: number;
  monthly_rent: number;
};

type FlexSchedule = {
  id: string;
  lease_id: string;
  space_id: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
};

type SpaceOccupancy = {
  space: Space;
  fullTimeLeases: (Lease & { lease_spaces: LeaseSpace[] })[];
  flexSchedules: Array<{ schedule: FlexSchedule; lease: Lease }>;
};

export function FlexOccupancy() {
  const [occupancies, setOccupancies] = useState<SpaceOccupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLeaseId, setSelectedLeaseId] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [availableFlexLeases, setAvailableFlexLeases] = useState<Lease[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'occupied' | 'available'>('all');
  const [spaceTypeFilter, setSpaceTypeFilter] = useState<'all' | 'full_time' | 'flex'>('flex');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<{
    leaseId: string;
    spaceId: string;
    spaceName: string;
    tenantName: string;
    creditsPerMonth: number;
    dayType: 'full_day' | 'half_day';
  } | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false
  });

  const workDays = [
    { key: 'monday', label: 'Ma' },
    { key: 'tuesday', label: 'Di' },
    { key: 'wednesday', label: 'Wo' },
    { key: 'thursday', label: 'Do' },
    { key: 'friday', label: 'Vr' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: spaces } = await supabase
      .from('office_spaces')
      .select('*')
      .order('space_number');

    const { data: fullTimeLeases } = await supabase
      .from('leases')
      .select(`
        *,
        tenants(*),
        lease_spaces(*)
      `)
      .eq('lease_type', 'full_time')
      .eq('status', 'active');

    const { data: flexLeases } = await supabase
      .from('leases')
      .select(`
        *,
        tenants(*)
      `)
      .eq('lease_type', 'flex')
      .eq('status', 'active');

    const { data: flexSchedules } = await supabase
      .from('flex_schedules')
      .select('*');

    setAvailableFlexLeases(flexLeases || []);

    const occupanciesData: SpaceOccupancy[] = (spaces || []).map(space => {
      const fullTimeForSpace = (fullTimeLeases || []).filter(lease =>
        lease.lease_spaces?.some((ls: LeaseSpace) => ls.space_id === space.id)
      );

      const flexSchedulesForSpace = (flexSchedules || [])
        .filter(schedule => schedule.space_id === space.id)
        .map(schedule => {
          const lease = (flexLeases || []).find(l => l.id === schedule.lease_id);
          return { schedule, lease: lease! };
        })
        .filter(item => item.lease);

      return {
        space,
        fullTimeLeases: fullTimeForSpace,
        flexSchedules: flexSchedulesForSpace
      };
    });

    setOccupancies(occupanciesData);
    setLoading(false);
  };

  const handleAddSchedule = async () => {
    if (!selectedLeaseId || !selectedSpaceId) {
      alert('Selecteer een flexer en ruimte');
      return;
    }

    if (!newSchedule.monday && !newSchedule.tuesday && !newSchedule.wednesday && !newSchedule.thursday && !newSchedule.friday) {
      alert('Selecteer minimaal één dag');
      return;
    }

    const { data, error } = await supabase
      .from('flex_schedules')
      .insert([{
        lease_id: selectedLeaseId,
        space_id: selectedSpaceId,
        ...newSchedule
      }])
      .select()
      .single();

    if (error) {
      alert('Deze flexer heeft al een planning voor deze ruimte');
      return;
    }

    await loadData();
    setShowAddForm(false);
    setSelectedLeaseId('');
    setSelectedSpaceId('');
    setNewSchedule({
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false
    });
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Weet je zeker dat je deze planning wilt verwijderen?')) {
      return;
    }

    await supabase
      .from('flex_schedules')
      .delete()
      .eq('id', scheduleId);

    await loadData();
  };

  const handleToggleDay = async (scheduleId: string, day: string, currentValue: boolean) => {
    await supabase
      .from('flex_schedules')
      .update({ [day]: !currentValue })
      .eq('id', scheduleId);

    await loadData();
  };

  const getDayOccupancy = (occupancy: SpaceOccupancy, day: string) => {
    if (!occupancy.space.is_flex_space || !occupancy.space.flex_capacity) {
      return { used: 0, capacity: 1 };
    }

    const used = occupancy.flexSchedules.filter(fs => (fs.schedule as any)[day]).length;
    return { used, capacity: occupancy.space.flex_capacity };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL');
  };

  const filteredOccupancies = occupancies.filter(occ => {
    const hasOccupants = occ.fullTimeLeases.length > 0 || occ.flexSchedules.length > 0;

    if (filterType === 'occupied' && !hasOccupants) return false;
    if (filterType === 'available' && hasOccupants) return false;

    if (spaceTypeFilter === 'flex' && !occ.space.is_flex_space) return false;
    if (spaceTypeFilter === 'full_time' && occ.space.is_flex_space) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSpace = occ.space.space_number.toLowerCase().includes(query);
      const matchesTenant = [
        ...occ.fullTimeLeases.map(l => l.tenants.company_name),
        ...occ.flexSchedules.map(fs => fs.lease.tenants.company_name)
      ].some(name => name.toLowerCase().includes(query));

      return matchesSpace || matchesTenant;
    }

    return true;
  });

  const fullTimeSpaces = filteredOccupancies.filter(occ => !occ.space.is_flex_space);
  const flexSpaces = filteredOccupancies.filter(occ => occ.space.is_flex_space);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><p className="text-gray-400">Laden...</p></div>;
  }

  return (
    <div className="h-full bg-dark-950 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Bezetting Overzicht</h1>
            <p className="text-gray-400 mt-1">Volledige overzicht van wie waar zit - vaste huurders en flexwerkers</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
          >
            {showAddForm ? <X size={20} /> : <Plus size={20} />}
            {showAddForm ? 'Annuleren' : 'Flex Planning Toevoegen'}
          </button>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Zoek op ruimte of huurder..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gold-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-gold-500 text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                Alle
              </button>
              <button
                onClick={() => setFilterType('occupied')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'occupied'
                    ? 'bg-gold-500 text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                Bezet
              </button>
              <button
                onClick={() => setFilterType('available')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === 'available'
                    ? 'bg-gold-500 text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                Beschikbaar
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 font-medium">Ruimte Type:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSpaceTypeFilter('flex')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  spaceTypeFilter === 'flex'
                    ? 'bg-blue-500 text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                <Users size={16} />
                Flexplekken
              </button>
              <button
                onClick={() => setSpaceTypeFilter('full_time')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  spaceTypeFilter === 'full_time'
                    ? 'bg-blue-500 text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                <Building2 size={16} />
                Vaste Verhuur
              </button>
              <button
                onClick={() => setSpaceTypeFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  spaceTypeFilter === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                Alles
              </button>
            </div>
          </div>
        </div>

        {showAddForm && (
          <div className="bg-dark-900 rounded-lg p-6 mb-6 border border-dark-700">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Nieuwe Planning</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Flexer
                  </label>
                  <select
                    value={selectedLeaseId}
                    onChange={(e) => setSelectedLeaseId(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-gold-500"
                  >
                    <option value="">Selecteer een flexer</option>
                    {availableFlexLeases.map(lease => (
                      <option key={lease.id} value={lease.id}>
                        {lease.tenants.company_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Flex Ruimte
                  </label>
                  <select
                    value={selectedSpaceId}
                    onChange={(e) => setSelectedSpaceId(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-gold-500"
                  >
                    <option value="">Selecteer een ruimte</option>
                    {occupancies.filter(occ => occ.space.is_flex_space).map(occ => (
                      <option key={occ.space.id} value={occ.space.id}>
                        {occ.space.space_number} (max {occ.space.flex_capacity} pers.)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Dagen
                </label>
                <div className="flex gap-2">
                  {workDays.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setNewSchedule({ ...newSchedule, [key]: !(newSchedule as any)[key] })}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        (newSchedule as any)[key]
                          ? 'bg-gold-500 text-white'
                          : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddSchedule}
                className="w-full flex items-center justify-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
              >
                <Save size={20} />
                Opslaan
              </button>
            </div>
          </div>
        )}

        {filteredOccupancies.length === 0 && (
          <div className="bg-dark-900 rounded-lg p-8 text-center border border-dark-700">
            <Building2 size={48} className="text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">
              Geen ruimtes gevonden die voldoen aan de zoekfilters.
            </p>
          </div>
        )}

        {spaceTypeFilter !== 'flex' && fullTimeSpaces.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Building2 size={24} className="text-gold-500" />
              <h2 className="text-xl font-bold text-gray-100">Vaste Verhuur</h2>
              <span className="text-sm text-gray-400">({fullTimeSpaces.length} ruimte{fullTimeSpaces.length !== 1 ? 's' : ''})</span>
            </div>
            {fullTimeSpaces.map(occupancy => {
              const hasOccupants = occupancy.fullTimeLeases.length > 0 || occupancy.flexSchedules.length > 0;

              return (
                <div key={occupancy.space.id} className="bg-dark-900 rounded-lg p-6 mb-6 border border-dark-700">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-100">{occupancy.space.space_number}</h3>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          hasOccupants
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {hasOccupants ? 'Bezet' : 'Beschikbaar'}
                        </span>
                        {occupancy.space.furnished && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-500/20 text-purple-400">
                            Gemeubileerd
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="capitalize">{occupancy.space.space_type}</span>
                        {occupancy.space.square_footage && (
                          <span>{occupancy.space.square_footage} m²</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!hasOccupants ? (
                    <div className="bg-dark-800 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500 italic">Deze ruimte is momenteel niet verhuurd</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {occupancy.fullTimeLeases.map(lease => (
                        <div key={lease.id} className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Building2 size={18} className="text-gold-500" />
                                <h4 className="font-semibold text-gray-100 text-lg">{lease.tenants.company_name}</h4>
                                <span className="text-xs px-2 py-0.5 rounded bg-gold-500/20 text-gold-400 font-medium">
                                  Vaste Huurder
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mt-3">
                                <div className="flex items-center gap-2 text-gray-400">
                                  <Users size={14} />
                                  <span>{lease.tenants.contact_name || 'Geen contactpersoon'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-400">
                                  <Calendar size={14} />
                                  <span>{formatDate(lease.start_date)} - {formatDate(lease.end_date)}</span>
                                </div>
                                {lease.tenants.email && (
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <Mail size={14} />
                                    <a href={`mailto:${lease.tenants.email}`} className="hover:text-gold-500 transition-colors">
                                      {lease.tenants.email}
                                    </a>
                                  </div>
                                )}
                                {lease.tenants.phone && (
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <Phone size={14} />
                                    <a href={`tel:${lease.tenants.phone}`} className="hover:text-gold-500 transition-colors">
                                      {lease.tenants.phone}
                                    </a>
                                  </div>
                                )}
                                {lease.lease_spaces && lease.lease_spaces.length > 0 && (
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <Euro size={14} />
                                    <span>
                                      {formatCurrency(lease.lease_spaces.find(ls => ls.space_id === occupancy.space.id)?.monthly_rent || 0)} /mnd
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {spaceTypeFilter !== 'full_time' && flexSpaces.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Users size={24} className="text-blue-400" />
              <h2 className="text-xl font-bold text-gray-100">Flexplekken</h2>
              <span className="text-sm text-gray-400">({flexSpaces.length} ruimte{flexSpaces.length !== 1 ? 's' : ''})</span>
            </div>
            {flexSpaces.map(occupancy => {
          const hasOccupants = occupancy.fullTimeLeases.length > 0 || occupancy.flexSchedules.length > 0;

          return (
            <div key={occupancy.space.id} className="bg-dark-900 rounded-lg p-6 mb-6 border border-dark-700">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-100">{occupancy.space.space_number}</h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      hasOccupants
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {hasOccupants ? 'Bezet' : 'Beschikbaar'}
                    </span>
                    {occupancy.space.furnished && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-500/20 text-purple-400">
                        Gemeubileerd
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="capitalize">{occupancy.space.space_type}</span>
                    {occupancy.space.square_footage && (
                      <span>{occupancy.space.square_footage} m²</span>
                    )}
                    {occupancy.space.is_flex_space && occupancy.space.flex_capacity && (
                      <span>Capaciteit: {occupancy.space.flex_capacity} personen</span>
                    )}
                  </div>
                </div>

                {occupancy.space.is_flex_space && occupancy.space.flex_capacity && (
                  <div className="flex gap-2">
                    {workDays.map(({ key, label }) => {
                      const { used, capacity } = getDayOccupancy(occupancy, key);
                      const percentage = (used / capacity) * 100;
                      return (
                        <div key={key} className="text-center">
                          <div className="text-xs text-gray-400 mb-1">{label}</div>
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold ${
                            used === 0 ? 'bg-dark-800 text-gray-500' :
                            percentage < 100 ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {used}/{capacity}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {!hasOccupants ? (
                <div className="bg-dark-800 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500 italic">Deze ruimte is momenteel niet verhuurd</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {occupancy.fullTimeLeases.map(lease => (
                    <div key={lease.id} className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 size={18} className="text-gold-500" />
                            <h4 className="font-semibold text-gray-100 text-lg">{lease.tenants.company_name}</h4>
                            <span className="text-xs px-2 py-0.5 rounded bg-gold-500/20 text-gold-400 font-medium">
                              Vaste Huurder
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mt-3">
                            <div className="flex items-center gap-2 text-gray-400">
                              <Users size={14} />
                              <span>{lease.tenants.contact_name || 'Geen contactpersoon'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Calendar size={14} />
                              <span>{formatDate(lease.start_date)} - {formatDate(lease.end_date)}</span>
                            </div>
                            {lease.tenants.email && (
                              <div className="flex items-center gap-2 text-gray-400">
                                <Mail size={14} />
                                <a href={`mailto:${lease.tenants.email}`} className="hover:text-gold-500 transition-colors">
                                  {lease.tenants.email}
                                </a>
                              </div>
                            )}
                            {lease.tenants.phone && (
                              <div className="flex items-center gap-2 text-gray-400">
                                <Phone size={14} />
                                <a href={`tel:${lease.tenants.phone}`} className="hover:text-gold-500 transition-colors">
                                  {lease.tenants.phone}
                                </a>
                              </div>
                            )}
                            {lease.lease_spaces && lease.lease_spaces.length > 0 && (
                              <div className="flex items-center gap-2 text-gray-400">
                                <Euro size={14} />
                                <span>
                                  {formatCurrency(lease.lease_spaces.find(ls => ls.space_id === occupancy.space.id)?.monthly_rent || 0)} /mnd
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {occupancy.flexSchedules.map(({ schedule, lease }) => (
                    <div key={schedule.id} className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Users size={18} className="text-blue-400" />
                            <h4 className="font-semibold text-gray-100 text-lg">{lease.tenants.company_name}</h4>
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                              Flexwerker
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              lease.flex_day_type === 'half_day'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {lease.flex_day_type === 'half_day' ? 'Halve dagen' : 'Hele dagen'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mt-3 mb-3">
                            <div className="flex items-center gap-2 text-gray-400">
                              <Users size={14} />
                              <span>{lease.tenants.contact_name || 'Geen contactpersoon'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Calendar size={14} />
                              <span>{formatDate(lease.start_date)} - {formatDate(lease.end_date)}</span>
                            </div>
                            {lease.tenants.email && (
                              <div className="flex items-center gap-2 text-gray-400">
                                <Mail size={14} />
                                <a href={`mailto:${lease.tenants.email}`} className="hover:text-gold-500 transition-colors">
                                  {lease.tenants.email}
                                </a>
                              </div>
                            )}
                            {lease.tenants.phone && (
                              <div className="flex items-center gap-2 text-gray-400">
                                <Phone size={14} />
                                <a href={`tel:${lease.tenants.phone}`} className="hover:text-gold-500 transition-colors">
                                  {lease.tenants.phone}
                                </a>
                              </div>
                            )}
                            {lease.flex_credits_per_month && lease.flex_credit_rate && (
                              <>
                                <div className="flex items-center gap-2 text-gray-400">
                                  <CreditCard size={14} />
                                  <span>{lease.flex_credits_per_month} dagen per maand</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-400">
                                  <Euro size={14} />
                                  <span>{formatCurrency(lease.flex_credit_rate)} per dag</span>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">Vaste dagen in deze ruimte:</label>
                              <div className="flex gap-1">
                                {workDays.map(({ key, label }) => {
                                  const isActive = (schedule as any)[key];
                                  return (
                                    <button
                                      key={key}
                                      onClick={() => handleToggleDay(schedule.id, key, isActive)}
                                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                        isActive
                                          ? 'bg-gold-500 text-white'
                                          : 'bg-dark-700 text-gray-500 hover:bg-dark-600'
                                      }`}
                                      title={`${label} ${isActive ? 'uitschakelen' : 'inschakelen'}`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {lease.flex_credits_per_month && (
                              <div className="pt-3 border-t border-dark-600">
                                <button
                                  onClick={() => {
                                    setSelectedBooking({
                                      leaseId: lease.id,
                                      spaceId: occupancy.space.id,
                                      spaceName: occupancy.space.space_number,
                                      tenantName: lease.tenants.company_name,
                                      creditsPerMonth: lease.flex_credits_per_month,
                                      dayType: lease.flex_day_type || 'full_day'
                                    });
                                    setBookingModalOpen(true);
                                  }}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                  <CalendarDays size={16} />
                                  Dagen Beheren ({lease.flex_credits_per_month} per maand)
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="ml-4 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                          title="Planning verwijderen"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            );
          })}
          </div>
        )}
      </div>

      {bookingModalOpen && selectedBooking && (
        <FlexDayBooking
          leaseId={selectedBooking.leaseId}
          spaceId={selectedBooking.spaceId}
          spaceName={selectedBooking.spaceName}
          tenantName={selectedBooking.tenantName}
          creditsPerMonth={selectedBooking.creditsPerMonth}
          dayType={selectedBooking.dayType}
          onClose={() => {
            setBookingModalOpen(false);
            setSelectedBooking(null);
            loadOccupancies();
          }}
        />
      )}
    </div>
  );
}
