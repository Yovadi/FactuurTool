import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Calendar, Save, X, Plus, Trash2, Check } from 'lucide-react';

type FlexSpace = {
  id: string;
  space_number: string;
  flex_capacity: number;
};

type FlexLease = {
  id: string;
  tenant_id: string;
  flex_credits_per_month: number | null;
  flex_credit_rate: number | null;
  flex_day_type: 'full_day' | 'half_day';
  start_date: string;
  end_date: string;
  status: string;
  tenants: {
    company_name: string;
  };
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

type FlexerSchedule = {
  lease: FlexLease;
  schedules: FlexSchedule[];
};

export function FlexOccupancy() {
  const [flexSpaces, setFlexSpaces] = useState<FlexSpace[]>([]);
  const [flexerSchedules, setFlexerSchedules] = useState<FlexerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLeaseId, setSelectedLeaseId] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [availableLeases, setAvailableLeases] = useState<FlexLease[]>([]);
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
    loadFlexData();
  }, []);

  const loadFlexData = async () => {
    setLoading(true);

    const { data: spaces } = await supabase
      .from('office_spaces')
      .select('id, space_number, flex_capacity')
      .eq('is_flex_space', true)
      .order('space_number');

    const { data: leases } = await supabase
      .from('leases')
      .select(`
        id,
        tenant_id,
        flex_credits_per_month,
        flex_credit_rate,
        flex_day_type,
        start_date,
        end_date,
        status,
        tenants:tenants(company_name)
      `)
      .eq('lease_type', 'flex')
      .eq('status', 'active');

    const { data: schedules } = await supabase
      .from('flex_schedules')
      .select('*');

    setFlexSpaces(spaces || []);
    setAvailableLeases(leases || []);

    const flexerSchedulesData: FlexerSchedule[] = (leases || []).map(lease => ({
      lease,
      schedules: (schedules || []).filter(s => s.lease_id === lease.id)
    }));

    setFlexerSchedules(flexerSchedulesData);
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

    await loadFlexData();
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

    await loadFlexData();
  };

  const handleToggleDay = async (scheduleId: string, day: string, currentValue: boolean) => {
    await supabase
      .from('flex_schedules')
      .update({ [day]: !currentValue })
      .eq('id', scheduleId);

    await loadFlexData();
  };

  const getSpaceSchedules = (spaceId: string) => {
    const schedules: Array<{ schedule: FlexSchedule; lease: FlexLease }> = [];

    flexerSchedules.forEach(fs => {
      fs.schedules.forEach(schedule => {
        if (schedule.space_id === spaceId) {
          schedules.push({ schedule, lease: fs.lease });
        }
      });
    });

    return schedules;
  };

  const getDayOccupancy = (spaceId: string, day: string) => {
    const schedules = getSpaceSchedules(spaceId);
    const space = flexSpaces.find(s => s.id === spaceId);
    if (!space) return { used: 0, capacity: 1 };

    const used = schedules.filter(s => (s.schedule as any)[day]).length;
    return { used, capacity: space.flex_capacity };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><p className="text-gray-400">Laden...</p></div>;
  }

  return (
    <div className="h-full bg-dark-950 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Flex Planning</h1>
            <p className="text-gray-400 mt-1">Beheer welke flexers op welke dagen in het kantoor mogen werken</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
          >
            {showAddForm ? <X size={20} /> : <Plus size={20} />}
            {showAddForm ? 'Annuleren' : 'Planning Toevoegen'}
          </button>
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
                    {availableLeases.map(lease => (
                      <option key={lease.id} value={lease.id}>
                        {lease.tenants.company_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Ruimte
                  </label>
                  <select
                    value={selectedSpaceId}
                    onChange={(e) => setSelectedSpaceId(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-gold-500"
                  >
                    <option value="">Selecteer een ruimte</option>
                    {flexSpaces.map(space => (
                      <option key={space.id} value={space.id}>
                        {space.space_number} (max {space.flex_capacity} pers.)
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

        {flexSpaces.length === 0 && (
          <div className="bg-dark-900 rounded-lg p-8 text-center border border-dark-700">
            <Users size={48} className="text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">
              Geen flex-ruimtes gevonden. Maak eerst ruimtes aan en markeer ze als flexplek.
            </p>
          </div>
        )}

        {flexSpaces.map(space => {
          const spaceSchedules = getSpaceSchedules(space.id);

          return (
            <div key={space.id} className="bg-dark-900 rounded-lg p-6 mb-6 border border-dark-700">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">{space.space_number}</h3>
                  <p className="text-sm text-gray-400">Capaciteit: {space.flex_capacity} personen</p>
                </div>
                <div className="flex gap-2">
                  {workDays.map(({ key, label }) => {
                    const { used, capacity } = getDayOccupancy(space.id, key);
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
              </div>

              {spaceSchedules.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Nog geen flexers ingepland</p>
              ) : (
                <div className="space-y-2">
                  {spaceSchedules.map(({ schedule, lease }) => (
                    <div key={schedule.id} className="bg-dark-800 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-200">{lease.tenants.company_name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              lease.flex_day_type === 'half_day'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {lease.flex_day_type === 'half_day' ? 'Halve dagen' : 'Hele dagen'}
                            </span>
                          </div>
                          <div className="flex gap-1 mt-2">
                            {workDays.map(({ key, label }) => {
                              const isActive = (schedule as any)[key];
                              return (
                                <button
                                  key={key}
                                  onClick={() => handleToggleDay(schedule.id, key, isActive)}
                                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                    isActive
                                      ? 'bg-gold-500 text-white'
                                      : 'bg-dark-700 text-gray-500'
                                  }`}
                                  title={`${label} ${isActive ? 'uitschakelen' : 'inschakelen'}`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="ml-4 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
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
    </div>
  );
}
