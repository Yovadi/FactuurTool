import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, TrendingUp, Calendar, Clock, BarChart3, Table, LineChart as LineChartIcon, Plus, Trash2, Save, X } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type FlexSpace = {
  id: string;
  space_number: string;
  size: number;
};

type FlexLease = {
  id: string;
  tenant_id: string;
  flex_pricing_model: 'daily' | 'monthly_unlimited' | 'credit_based';
  flex_daily_rate: number | null;
  flex_monthly_rate: number | null;
  flex_credits_per_month: number | null;
  flex_credit_rate: number | null;
  start_date: string;
  end_date: string;
  status: string;
  tenants: {
    company_name: string;
  };
};

type WeekDay = {
  day: string;
  date: string;
  hoursBooked: number;
  utilization: number;
};

type TenantUsage = {
  tenant_name: string;
  hours_allocated: number;
  hours_used: number;
  percentage: number;
};

type WeeklyTrend = {
  week: string;
  hours: number;
  utilization: number;
};

type FlexBooking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  tenant_id: string;
  space_id: string;
  status: string;
  tenants?: {
    company_name: string;
  };
};

export function FlexOccupancy() {
  const [flexSpaces, setFlexSpaces] = useState<FlexSpace[]>([]);
  const [flexLeases, setFlexLeases] = useState<FlexLease[]>([]);
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [tenantUsage, setTenantUsage] = useState<TenantUsage[]>([]);
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [weekView, setWeekView] = useState<'table' | 'chart'>('table');
  const [trendView, setTrendView] = useState<'table' | 'chart'>('chart');
  const [showPlanning, setShowPlanning] = useState(false);
  const [planningWeek, setPlanningWeek] = useState(0);
  const [flexBookings, setFlexBookings] = useState<FlexBooking[]>([]);
  const [newBooking, setNewBooking] = useState({
    tenant_id: '',
    space_id: '',
    date: '',
    start_time: '09:00',
    end_time: '17:00'
  });

  const totalFlexHoursPerDay = 8;
  const workDays = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];

  useEffect(() => {
    loadFlexData();
  }, []);

  useEffect(() => {
    if (flexSpaces.length > 0 && flexLeases.length > 0) {
      loadWeekData(flexSpaces, flexLeases);
    }
  }, [selectedWeek]);

  useEffect(() => {
    if (showPlanning) {
      loadFlexBookings();
    }
  }, [planningWeek, showPlanning]);

  const getWeekDates = (weekOffset: number) => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diff + (weekOffset * 7));

    const dates = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  const loadFlexData = async () => {
    setLoading(true);

    const { data: spaces, error: spacesError } = await supabase
      .from('office_spaces')
      .select('id, space_number, size')
      .eq('is_flex_space', true)
      .order('space_number');

    console.log('Flex spaces:', spaces, spacesError);

    const { data: leases, error: leasesError } = await supabase
      .from('leases')
      .select(`
        id,
        tenant_id,
        flex_pricing_model,
        flex_daily_rate,
        flex_monthly_rate,
        flex_credits_per_month,
        flex_credit_rate,
        start_date,
        end_date,
        status,
        tenants (
          company_name
        )
      `)
      .eq('lease_type', 'flex');

    console.log('Flex leases:', leases, leasesError);

    setFlexSpaces(spaces || []);
    setFlexLeases(leases || []);

    await loadWeekData(spaces || [], leases || []);
    await loadTenantUsage(leases || []);
    await loadWeeklyTrends(spaces || []);

    setLoading(false);
  };

  const loadWeekData = async (spaces: FlexSpace[], leases: FlexLease[]) => {
    const weekDates = getWeekDates(selectedWeek);
    const weekStart = formatDate(weekDates[0]);
    const weekEnd = formatDate(weekDates[4]);

    const { data: bookings } = await supabase
      .from('meeting_room_bookings')
      .select('booking_date, start_time, end_time, space_id')
      .gte('booking_date', weekStart)
      .lte('booking_date', weekEnd)
      .in('space_id', spaces.map(s => s.id));

    const weekDataResult: WeekDay[] = weekDates.map((date, index) => {
      const dateStr = formatDate(date);
      const dayBookings = bookings?.filter(b => b.booking_date === dateStr) || [];

      const hoursBooked = dayBookings.reduce((sum, booking) => {
        const start = new Date(`2000-01-01T${booking.start_time}`);
        const end = new Date(`2000-01-01T${booking.end_time}`);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);

      const totalAvailableHours = spaces.length * totalFlexHoursPerDay;
      const utilization = totalAvailableHours > 0 ? (hoursBooked / totalAvailableHours) * 100 : 0;

      return {
        day: workDays[index],
        date: formatDisplayDate(date),
        hoursBooked: Math.round(hoursBooked * 10) / 10,
        utilization: Math.round(utilization)
      };
    });

    setWeekData(weekDataResult);
  };

  const loadTenantUsage = async (leases: FlexLease[]) => {
    const currentDate = new Date().toISOString().split('T')[0];
    const activeLeases = leases.filter(l =>
      l.status === 'active' &&
      l.start_date <= currentDate &&
      l.end_date >= currentDate
    );

    console.log('Active flex leases:', activeLeases);

    const currentMonth = new Date().toISOString().slice(0, 7);

    const usageData: TenantUsage[] = await Promise.all(
      activeLeases.map(async (lease) => {
        const { data: bookings, error: bookingsError } = await supabase
          .from('meeting_room_bookings')
          .select('start_time, end_time, booking_date')
          .eq('tenant_id', lease.tenant_id)
          .gte('booking_date', `${currentMonth}-01`)
          .lte('booking_date', `${currentMonth}-31`);

        console.log(`Bookings for tenant ${lease.tenants?.company_name}:`, bookings, bookingsError);

        const hoursUsed = bookings?.reduce((sum, booking) => {
          const start = new Date(`2000-01-01T${booking.start_time}`);
          const end = new Date(`2000-01-01T${booking.end_time}`);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }, 0) || 0;

        let hoursAllocated = 0;
        if (lease.flex_pricing_model === 'credit_based') {
          hoursAllocated = lease.flex_credits_per_month || 0;
        } else if (lease.flex_pricing_model === 'monthly_unlimited') {
          hoursAllocated = 160;
        } else if (lease.flex_pricing_model === 'daily') {
          hoursAllocated = 160;
        } else {
          hoursAllocated = 0;
        }

        const percentage = hoursAllocated > 0 ? (hoursUsed / hoursAllocated) * 100 : 0;

        console.log(`Tenant ${lease.tenants?.company_name}: ${hoursUsed}/${hoursAllocated} hours (${percentage}%) - Model: ${lease.flex_pricing_model}`);

        return {
          tenant_name: lease.tenants?.company_name || 'Onbekend',
          hours_allocated: hoursAllocated,
          hours_used: Math.round(hoursUsed * 10) / 10,
          percentage: Math.round(percentage)
        };
      })
    );

    console.log('Final tenant usage:', usageData);
    setTenantUsage(usageData);
  };

  const loadWeeklyTrends = async (spaces: FlexSpace[]) => {
    if (spaces.length === 0) {
      setWeeklyTrends([]);
      return;
    }

    const oldestWeekDates = getWeekDates(-7);
    const newestWeekDates = getWeekDates(0);
    const startDate = formatDate(oldestWeekDates[0]);
    const endDate = formatDate(newestWeekDates[4]);

    const { data: allBookings } = await supabase
      .from('meeting_room_bookings')
      .select('start_time, end_time, booking_date')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .in('space_id', spaces.map(s => s.id));

    const trends: WeeklyTrend[] = [];

    for (let i = 7; i >= 0; i--) {
      const weekDates = getWeekDates(-i);
      const weekStart = formatDate(weekDates[0]);
      const weekEnd = formatDate(weekDates[4]);

      const weekBookings = allBookings?.filter(b =>
        b.booking_date >= weekStart && b.booking_date <= weekEnd
      ) || [];

      const totalHours = weekBookings.reduce((sum, booking) => {
        const start = new Date(`2000-01-01T${booking.start_time}`);
        const end = new Date(`2000-01-01T${booking.end_time}`);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);

      const totalAvailableHours = spaces.length * totalFlexHoursPerDay * 5;
      const utilization = totalAvailableHours > 0 ? (totalHours / totalAvailableHours) * 100 : 0;

      const weekLabel = `${formatDisplayDate(weekDates[0])} - ${formatDisplayDate(weekDates[4])}`;

      trends.push({
        week: weekLabel,
        hours: Math.round(totalHours * 10) / 10,
        utilization: Math.round(utilization)
      });
    }

    setWeeklyTrends(trends);
  };

  const loadFlexBookings = async () => {
    const weekDates = getWeekDates(planningWeek);
    const weekStart = formatDate(weekDates[0]);
    const weekEnd = formatDate(weekDates[4]);

    const { data, error } = await supabase
      .from('meeting_room_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        tenant_id,
        space_id,
        status,
        tenants (
          company_name
        )
      `)
      .eq('booking_type', 'flex')
      .gte('booking_date', weekStart)
      .lte('booking_date', weekEnd)
      .in('space_id', flexSpaces.map(s => s.id))
      .order('booking_date')
      .order('start_time');

    if (!error && data) {
      setFlexBookings(data as FlexBooking[]);
    }
  };

  const handleAddFlexBooking = async () => {
    if (!newBooking.tenant_id || !newBooking.space_id || !newBooking.date) {
      alert('Vul alle velden in');
      return;
    }

    const start = new Date(`2000-01-01T${newBooking.start_time}`);
    const end = new Date(`2000-01-01T${newBooking.end_time}`);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    const { error } = await supabase
      .from('meeting_room_bookings')
      .insert({
        space_id: newBooking.space_id,
        tenant_id: newBooking.tenant_id,
        booking_date: newBooking.date,
        start_time: newBooking.start_time,
        end_time: newBooking.end_time,
        booking_type: 'flex',
        total_hours: hours,
        total_amount: 0,
        hourly_rate: 0,
        status: 'confirmed'
      });

    if (!error) {
      setNewBooking({
        tenant_id: '',
        space_id: '',
        date: '',
        start_time: '09:00',
        end_time: '17:00'
      });
      await loadFlexBookings();
      await loadFlexData();
    } else {
      alert('Fout bij het toevoegen van boeking: ' + error.message);
    }
  };

  const handleDeleteFlexBooking = async (bookingId: string) => {
    if (!confirm('Weet je zeker dat je deze flex-boeking wilt verwijderen?')) {
      return;
    }

    const { error } = await supabase
      .from('meeting_room_bookings')
      .delete()
      .eq('id', bookingId);

    if (!error) {
      await loadFlexBookings();
      await loadFlexData();
    } else {
      alert('Fout bij het verwijderen: ' + error.message);
    }
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization < 40) return 'text-green-400';
    if (utilization < 70) return 'text-amber-400';
    return 'text-red-400';
  };

  const getUtilizationBgColor = (utilization: number) => {
    if (utilization < 40) return 'bg-green-500/20 border-green-500';
    if (utilization < 70) return 'bg-amber-500/20 border-amber-500';
    return 'bg-red-500/20 border-red-500';
  };

  const totalFlexSpaces = flexSpaces.length;
  const activeFlexLeases = flexLeases.filter(l => {
    const currentDate = new Date().toISOString().split('T')[0];
    return l.status === 'active' && l.start_date <= currentDate && l.end_date >= currentDate;
  }).length;

  const totalAllocatedHours = flexLeases
    .filter(l => {
      const currentDate = new Date().toISOString().split('T')[0];
      return l.status === 'active' && l.start_date <= currentDate && l.end_date >= currentDate;
    })
    .reduce((sum, l) => {
      if (l.flex_pricing_model === 'credit_based') {
        return sum + (l.flex_credits_per_month || 0);
      } else if (l.flex_pricing_model === 'monthly_unlimited' || l.flex_pricing_model === 'daily') {
        return sum + 160;
      }
      return sum;
    }, 0);

  const totalUsedHours = tenantUsage.reduce((sum, t) => sum + t.hours_used, 0);
  const averageUtilization = totalAllocatedHours > 0
    ? Math.round((totalUsedHours / totalAllocatedHours) * 100)
    : 0;

  const weekAvgUtilization = weekData.length > 0
    ? Math.round(weekData.reduce((sum, d) => sum + d.utilization, 0) / weekData.length)
    : 0;

  const activeFlexTenants = flexLeases.filter(l => {
    const currentDate = new Date().toISOString().split('T')[0];
    return l.status === 'active' && l.start_date <= currentDate && l.end_date >= currentDate;
  });

  if (loading) {
    return <div className="text-center py-8 text-gray-300">Flex bezetting laden...</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Flex Plekken Bezetting</h2>
          <p className="text-gray-300">Overzicht van flex werkplekken en gebruik</p>
        </div>
        <button
          onClick={() => setShowPlanning(!showPlanning)}
          className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-600 text-dark-950 rounded-lg font-semibold transition-colors"
        >
          <Calendar size={20} />
          {showPlanning ? 'Sluit Planning' : 'Open Planning'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Users className="text-blue-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Totaal Flex Plekken</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">{totalFlexSpaces}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              Beschikbare werkplekken
            </p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Calendar className="text-emerald-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Actieve Flex Huurders</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">{activeFlexLeases}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              Met flex contract
            </p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Clock className="text-amber-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Uren Deze Maand</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">{totalUsedHours}</p>
              <p className="text-lg text-gray-400 ml-2">/ {totalAllocatedHours}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              Gebruikt van toegewezen
            </p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <TrendingUp className="text-gold-500" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Gemiddelde Bezetting</p>
            <div className="h-12 flex items-center">
              <p className={`text-3xl font-bold ${getUtilizationColor(averageUtilization)}`}>
                {averageUtilization}%
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              Van toegewezen uren
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-dark-700 rounded-lg">
                <Calendar className="text-gold-500" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-gray-100">Weekoverzicht</h3>
            </div>
            <div className="flex gap-2">
              <div className="flex bg-dark-800 rounded-lg p-1">
                <button
                  onClick={() => setWeekView('table')}
                  className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                    weekView === 'table' ? 'bg-gold-500 text-dark-950' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Table size={16} />
                </button>
                <button
                  onClick={() => setWeekView('chart')}
                  className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                    weekView === 'chart' ? 'bg-gold-500 text-dark-950' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <BarChart3 size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-2 mb-4">
            <button
              onClick={() => setSelectedWeek(selectedWeek - 1)}
              className="px-3 py-1 bg-dark-700 hover:bg-dark-600 text-gray-200 rounded transition-colors"
            >
              ←
            </button>
            <span className="px-4 py-1 text-gray-200">
              {selectedWeek === 0 ? 'Deze week' : selectedWeek === -1 ? 'Vorige week' : selectedWeek === 1 ? 'Volgende week' : `Week ${selectedWeek > 0 ? '+' : ''}${selectedWeek}`}
            </span>
            <button
              onClick={() => setSelectedWeek(selectedWeek + 1)}
              className="px-3 py-1 bg-dark-700 hover:bg-dark-600 text-gray-200 rounded transition-colors"
            >
              →
            </button>
          </div>

          {weekView === 'table' ? (
            <div className="space-y-2">
              {weekData.map((day) => (
                <div key={day.day} className="p-4 bg-dark-800 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <span className="font-semibold text-gray-100">{day.day}</span>
                      <span className="text-sm text-gray-400 ml-2">{day.date}</span>
                    </div>
                    <span className={`text-lg font-bold ${getUtilizationColor(day.utilization)}`}>
                      {day.utilization}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-dark-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          day.utilization < 40 ? 'bg-green-500' :
                          day.utilization < 70 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(day.utilization, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-300 min-w-[80px] text-right">
                      {day.hoursBooked} uur
                    </span>
                  </div>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-dark-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-300">Weekgemiddelde</span>
                  <span className={`text-lg font-bold ${getUtilizationColor(weekAvgUtilization)}`}>
                    {weekAvgUtilization}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                />
                <Legend wrapperStyle={{ color: '#9CA3AF' }} />
                <Bar dataKey="utilization" name="Bezetting %" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-dark-700 rounded-lg">
              <Users className="text-emerald-400" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-100">Gebruik per Huurder (Deze Maand)</h3>
          </div>

          {tenantUsage.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Geen actieve flex huurders</p>
          ) : (
            <div className="space-y-3">
              {tenantUsage.map((tenant) => (
                <div key={tenant.tenant_name} className="p-4 bg-dark-800 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-100">{tenant.tenant_name}</span>
                    <span className={`text-lg font-bold ${getUtilizationColor(tenant.percentage)}`}>
                      {tenant.percentage}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 bg-dark-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          tenant.percentage < 40 ? 'bg-green-500' :
                          tenant.percentage < 70 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(tenant.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    {tenant.hours_used} van {tenant.hours_allocated} uur gebruikt
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-dark-700 rounded-lg">
              <TrendingUp className="text-blue-400" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-100">Trend (Afgelopen 8 Weken)</h3>
          </div>
          <div className="flex bg-dark-800 rounded-lg p-1">
            <button
              onClick={() => setTrendView('table')}
              className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                trendView === 'table' ? 'bg-gold-500 text-dark-950' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Table size={16} />
            </button>
            <button
              onClick={() => setTrendView('chart')}
              className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                trendView === 'chart' ? 'bg-gold-500 text-dark-950' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <LineChartIcon size={16} />
            </button>
          </div>
        </div>

        {trendView === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Week</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Uren Geboekt</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Bezetting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {weeklyTrends.map((trend, index) => (
                  <tr key={index} className="hover:bg-dark-800/50">
                    <td className="px-4 py-3 text-sm text-gray-300">{trend.week}</td>
                    <td className="px-4 py-3 text-sm text-gray-200 text-right font-semibold">
                      {trend.hours} uur
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold ${getUtilizationColor(trend.utilization)}`}>
                        {trend.utilization}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="week"
                stroke="#9CA3AF"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Legend wrapperStyle={{ color: '#9CA3AF' }} />
              <Line type="monotone" dataKey="utilization" name="Bezetting %" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {showPlanning && (
        <div className="mt-8 bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-dark-700 rounded-lg">
              <Calendar className="text-gold-500" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-100">Flex Planning</h3>
          </div>

          <div className="flex justify-center gap-2 mb-6">
            <button
              onClick={() => setPlanningWeek(planningWeek - 1)}
              className="px-3 py-1 bg-dark-700 hover:bg-dark-600 text-gray-200 rounded transition-colors"
            >
              ←
            </button>
            <span className="px-4 py-1 text-gray-200">
              {planningWeek === 0 ? 'Deze week' : planningWeek === -1 ? 'Vorige week' : planningWeek === 1 ? 'Volgende week' : `Week ${planningWeek > 0 ? '+' : ''}${planningWeek}`}
            </span>
            <button
              onClick={() => setPlanningWeek(planningWeek + 1)}
              className="px-3 py-1 bg-dark-700 hover:bg-dark-600 text-gray-200 rounded transition-colors"
            >
              →
            </button>
          </div>

          <div className="bg-dark-800 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-semibold text-gray-200 mb-4">Nieuwe Flex-Boeking</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                value={newBooking.tenant_id}
                onChange={(e) => setNewBooking({ ...newBooking, tenant_id: e.target.value })}
                className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 focus:outline-none focus:border-gold-500"
              >
                <option value="">Selecteer huurder</option>
                {activeFlexTenants.map(lease => (
                  <option key={lease.tenant_id} value={lease.tenant_id}>
                    {lease.tenants?.company_name}
                  </option>
                ))}
              </select>

              <select
                value={newBooking.space_id}
                onChange={(e) => setNewBooking({ ...newBooking, space_id: e.target.value })}
                className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 focus:outline-none focus:border-gold-500"
              >
                <option value="">Selecteer flex plek</option>
                {flexSpaces.map(space => (
                  <option key={space.id} value={space.id}>
                    Plek {space.space_number}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={newBooking.date}
                onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })}
                className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 focus:outline-none focus:border-gold-500"
              />

              <div className="flex gap-2">
                <input
                  type="time"
                  value={newBooking.start_time}
                  onChange={(e) => setNewBooking({ ...newBooking, start_time: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 focus:outline-none focus:border-gold-500"
                />
                <span className="flex items-center text-gray-400">-</span>
                <input
                  type="time"
                  value={newBooking.end_time}
                  onChange={(e) => setNewBooking({ ...newBooking, end_time: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 focus:outline-none focus:border-gold-500"
                />
              </div>

              <button
                onClick={handleAddFlexBooking}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
              >
                <Plus size={18} />
                Toevoegen
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {getWeekDates(planningWeek).map((date, index) => {
              const dateStr = formatDate(date);
              const dayBookings = flexBookings.filter(b => b.booking_date === dateStr);

              return (
                <div key={dateStr} className="bg-dark-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <span className="font-semibold text-gray-100">{workDays[index]}</span>
                      <span className="text-sm text-gray-400 ml-2">{formatDisplayDate(date)}</span>
                    </div>
                    <span className="text-sm text-gray-400">{dayBookings.length} boeking(en)</span>
                  </div>

                  {dayBookings.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Geen boekingen</p>
                  ) : (
                    <div className="space-y-2">
                      {dayBookings.map(booking => (
                        <div key={booking.id} className="flex justify-between items-center bg-dark-700 rounded p-3">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-200">
                              {booking.tenants?.company_name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteFlexBooking(booking.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
