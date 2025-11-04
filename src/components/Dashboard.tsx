import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building, Users, AlertCircle, Calendar, Clock, CalendarClock, FileText, DollarSign } from 'lucide-react';

type DashboardStats = {
  totalTenants: number;
  totalSpaces: number;
  occupiedSpaces: number;
  todayBookings: number;
  upcomingBookings: number;
  totalBookings: number;
};

type Notification = {
  type: 'danger' | 'warning' | 'info' | 'success';
  icon: React.ReactNode;
  title: string;
  message: string;
};

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTenants: 0,
    totalSpaces: 0,
    occupiedSpaces: 0,
    todayBookings: 0,
    upcomingBookings: 0,
    totalBookings: 0
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    setLoading(true);

    const { data: tenants } = await supabase
      .from('tenants')
      .select('id');

    const { data: spaces } = await supabase
      .from('office_spaces')
      .select('is_available, space_type')
      .in('space_type', ['kantoor', 'bedrijfsruimte']);

    const { data: leases } = await supabase
      .from('leases')
      .select('id, end_date, status, tenant_id, tenants(name)');

    const { data: leaseSpaces } = await supabase
      .from('lease_spaces')
      .select('space_id, lease_id, leases!inner(status)');

    const { data: invoices } = await supabase
      .from('invoices')
      .select('amount, status, due_date');

    const { data: bookings } = await supabase
      .from('meeting_room_bookings')
      .select('id, booking_date, start_time, end_time, status');

    const activeLeaseSpaceIds = new Set(
      leaseSpaces
        ?.filter(ls => ls.leases?.status === 'active')
        .map(ls => ls.space_id) || []
    );

    const occupiedSpaces = activeLeaseSpaceIds.size;
    const totalRentableSpaces = spaces?.length || 0;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const fourteenDaysFromNow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const fourteenDaysStr = fourteenDaysFromNow.toISOString().split('T')[0];
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

    const todayBookings = bookings?.filter(b => b.booking_date === todayStr && b.status !== 'cancelled').length || 0;
    const upcomingBookings = bookings?.filter(
      b => b.booking_date >= todayStr && b.booking_date <= sevenDaysStr && b.status !== 'cancelled'
    ).length || 0;

    const expiringLeases = leases?.filter(
      lease => lease.status === 'active' && lease.end_date >= todayStr && lease.end_date <= fourteenDaysStr
    ) || [];

    const expiredLeases = leases?.filter(
      lease => lease.status === 'active' && lease.end_date < todayStr
    ) || [];

    const overdueInvoices = invoices?.filter(
      inv => inv.status !== 'paid' && inv.due_date < todayStr
    ) || [];

    const upcomingDueInvoices = invoices?.filter(
      inv => inv.status !== 'paid' && inv.due_date >= todayStr && inv.due_date <= sevenDaysStr
    ) || [];

    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

    setStats({
      totalTenants: tenants?.length || 0,
      totalSpaces: totalRentableSpaces,
      occupiedSpaces,
      todayBookings,
      upcomingBookings,
      totalBookings: bookings?.length || 0
    });

    const newNotifications: Notification[] = [];

    if (overdueInvoices.length > 0) {
      newNotifications.push({
        type: 'danger',
        icon: <DollarSign size={18} />,
        title: 'Achterstallige Facturen',
        message: `${overdueInvoices.length} factu${overdueInvoices.length !== 1 ? 'ren' : 'ur'} over de vervaldatum (€${overdueAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
      });
    }

    if (expiredLeases.length > 0) {
      newNotifications.push({
        type: 'danger',
        icon: <Calendar size={18} />,
        title: 'Verlopen Contracten',
        message: `${expiredLeases.length} contract${expiredLeases.length !== 1 ? 'en zijn' : ' is'} verlopen en moet${expiredLeases.length !== 1 ? 'en' : ''} worden verlengd of beëindigd`
      });
    }

    if (upcomingDueInvoices.length > 0) {
      newNotifications.push({
        type: 'warning',
        icon: <FileText size={18} />,
        title: 'Binnenkort Te Betalen',
        message: `${upcomingDueInvoices.length} factu${upcomingDueInvoices.length !== 1 ? 'ren' : 'ur'} moet${upcomingDueInvoices.length !== 1 ? 'en' : ''} binnen 7 dagen betaald worden`
      });
    }

    if (expiringLeases.length > 0) {
      newNotifications.push({
        type: 'warning',
        icon: <Clock size={18} />,
        title: 'Contracten Verlopen Binnenkort',
        message: `${expiringLeases.length} contract${expiringLeases.length !== 1 ? 'en verlopen' : ' verloopt'} binnen 14 dagen`
      });
    }

    if (todayBookings > 0) {
      newNotifications.push({
        type: 'info',
        icon: <CalendarClock size={18} />,
        title: 'Vergaderruimte Boekingen Vandaag',
        message: `${todayBookings} boeking${todayBookings !== 1 ? 'en' : ''} gepland voor vandaag`
      });
    }

    const availableSpaces = totalRentableSpaces - occupiedSpaces;
    if (availableSpaces > 0) {
      newNotifications.push({
        type: 'info',
        icon: <Building size={18} />,
        title: 'Beschikbare Ruimtes',
        message: `${availableSpaces} ruimte${availableSpaces !== 1 ? 's' : ''} beschikbaar voor verhuur`
      });
    }

    setNotifications(newNotifications);
    setLoading(false);
  };

  const occupancyRate = stats.totalSpaces > 0
    ? ((stats.occupiedSpaces / stats.totalSpaces) * 100).toFixed(1)
    : 0;

  if (loading) {
    return <div className="text-center py-8">Dashboard laden...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Overzicht</h1>
        <p className="text-gray-300">Overzicht van je kantoorgebouw beheer</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Users className="text-gold-500" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Totaal Huurders</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">{stats.totalTenants}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5 invisible">.</p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Building className="text-green-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Totaal Ruimtes</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">{stats.totalSpaces}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              {stats.occupiedSpaces} bezet, {stats.totalSpaces - stats.occupiedSpaces} beschikbaar
            </p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Building className="text-blue-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Bezettingsgraad</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">{occupancyRate}%</p>
            </div>
            <div className="w-full bg-dark-800 rounded-full h-2 mt-1">
              <div
                className="bg-gradient-to-r from-gold-500 to-gold-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${occupancyRate}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <CalendarClock className="text-purple-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Vergaderruimte Boekingen</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">{stats.todayBookings}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              {stats.upcomingBookings} komende week
            </p>
          </div>
        </div>
      </div>

      <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-dark-700 rounded-lg">
            <AlertCircle className="text-amber-400" size={20} />
          </div>
          <h3 className="text-lg font-semibold text-gray-100">Meldingen & Notificaties</h3>
        </div>
        <div className="space-y-3">
          {notifications.length > 0 ? (
            notifications.map((notification, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  notification.type === 'danger'
                    ? 'bg-red-900/50 border border-red-800'
                    : notification.type === 'warning'
                    ? 'bg-amber-900/50 border border-amber-800'
                    : notification.type === 'info'
                    ? 'bg-blue-900/50 border border-blue-800'
                    : 'bg-green-900/50 border border-green-800'
                }`}
              >
                <div
                  className={`mt-0.5 ${
                    notification.type === 'danger'
                      ? 'text-red-400'
                      : notification.type === 'warning'
                      ? 'text-amber-400'
                      : notification.type === 'info'
                      ? 'text-blue-400'
                      : 'text-green-400'
                  }`}
                >
                  {notification.icon}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      notification.type === 'danger'
                        ? 'text-red-400'
                        : notification.type === 'warning'
                        ? 'text-amber-400'
                        : notification.type === 'info'
                        ? 'text-blue-400'
                        : 'text-green-400'
                    }`}
                  >
                    {notification.title}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      notification.type === 'danger'
                        ? 'text-red-300'
                        : notification.type === 'warning'
                        ? 'text-amber-300'
                        : notification.type === 'info'
                        ? 'text-blue-300'
                        : 'text-green-300'
                    }`}
                  >
                    {notification.message}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              Geen notificaties op dit moment
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
