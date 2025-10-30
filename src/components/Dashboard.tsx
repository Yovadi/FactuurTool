import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building, Users, FileText, TrendingUp, AlertCircle, Euro, Calendar, Clock, CalendarDays } from 'lucide-react';

type DashboardStats = {
  totalTenants: number;
  totalSpaces: number;
  occupiedSpaces: number;
  totalInvoices: number;
  totalRevenue: number;
  paidRevenue: number;
  overdueInvoices: number;
  pendingAmount: number;
  forecastNextMonth: number;
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
    totalInvoices: 0,
    totalRevenue: 0,
    paidRevenue: 0,
    overdueInvoices: 0,
    pendingAmount: 0,
    forecastNextMonth: 0
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
      .select('is_available');

    const { data: invoices } = await supabase
      .from('invoices')
      .select('amount, status, due_date');

    const { data: leases } = await supabase
      .from('leases')
      .select('id, end_date, status, tenant_id, tenants(name)');

    const occupiedSpaces = spaces?.filter(s => !s.is_available).length || 0;

    const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
    const paidRevenue = invoices?.filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const fourteenDaysFromNow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const fourteenDaysStr = fourteenDaysFromNow.toISOString().split('T')[0];

    const overdueInvoices = invoices?.filter(
      inv => inv.status !== 'paid' && inv.due_date < todayStr
    ).length || 0;

    const upcomingDueInvoices = invoices?.filter(
      inv => inv.status !== 'paid' && inv.due_date >= todayStr && inv.due_date <= fourteenDaysStr
    ).length || 0;

    const expiringLeases = leases?.filter(
      lease => lease.status === 'active' && lease.end_date >= todayStr && lease.end_date <= fourteenDaysStr
    ) || [];

    const expiredLeases = leases?.filter(
      lease => lease.status === 'active' && lease.end_date < todayStr
    ) || [];

    const pendingAmount = invoices?.filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

    const { data: leaseSpaces } = await supabase
      .from('lease_spaces')
      .select('monthly_rent, lease_id, leases!inner(status, start_date, end_date)');

    const activeLeaseSpaces = leaseSpaces?.filter(ls => {
      const lease = ls.leases;
      return lease.status === 'active' &&
             lease.start_date <= todayStr &&
             lease.end_date >= todayStr;
    }) || [];

    const forecastNextMonth = activeLeaseSpaces.reduce((sum, ls) =>
      sum + Number(ls.monthly_rent), 0
    );

    setStats({
      totalTenants: tenants?.length || 0,
      totalSpaces: spaces?.length || 0,
      occupiedSpaces,
      totalInvoices: invoices?.length || 0,
      totalRevenue,
      paidRevenue,
      overdueInvoices,
      pendingAmount,
      forecastNextMonth
    });

    const newNotifications: Notification[] = [];

    if (overdueInvoices > 0) {
      newNotifications.push({
        type: 'danger',
        icon: <AlertCircle size={18} />,
        title: 'Achterstallige Facturen',
        message: `${overdueInvoices} factu${overdueInvoices !== 1 ? 'ren' : 'ur'} over de vervaldatum`
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

    if (expiringLeases.length > 0) {
      newNotifications.push({
        type: 'warning',
        icon: <Clock size={18} />,
        title: 'Contracten Verlopen Binnenkort',
        message: `${expiringLeases.length} contract${expiringLeases.length !== 1 ? 'en verlopen' : ' verloopt'} binnen 14 dagen`
      });
    }

    if (upcomingDueInvoices > 0) {
      newNotifications.push({
        type: 'warning',
        icon: <FileText size={18} />,
        title: 'Binnenkort Te Betalen',
        message: `${upcomingDueInvoices} factu${upcomingDueInvoices !== 1 ? 'ren' : 'ur'} moet${upcomingDueInvoices !== 1 ? 'en' : ''} binnen 14 dagen betaald worden`
      });
    }

    const availableSpaces = (stats.totalSpaces || spaces?.length || 0) - occupiedSpaces;
    if (availableSpaces > 0) {
      newNotifications.push({
        type: 'info',
        icon: <Building size={18} />,
        title: 'Beschikbare Ruimtes',
        message: `${availableSpaces} ruimte${availableSpaces !== 1 ? 's' : ''} beschikbaar voor verhuur`
      });
    }

    if (newNotifications.length === 0) {
      newNotifications.push({
        type: 'success',
        icon: <TrendingUp size={18} />,
        title: 'Alles in Orde',
        message: 'Geen urgente zaken die aandacht vereisen'
      });
    }

    setNotifications(newNotifications);
    setLoading(false);
  };

  const occupancyRate = stats.totalSpaces > 0
    ? ((stats.occupiedSpaces / stats.totalSpaces) * 100).toFixed(1)
    : 0;

  const collectionRate = stats.totalRevenue > 0
    ? ((stats.paidRevenue / stats.totalRevenue) * 100).toFixed(1)
    : 0;

  if (loading) {
    return <div className="text-center py-8">Dashboard laden...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Dashboard</h1>
        <p className="text-gray-300">Overzicht van je kantoorgebouw beheer</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Users className="text-gold-500" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Totaal Huurders</p>
            <p className="text-3xl font-bold text-gray-100">{stats.totalTenants}</p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Building className="text-green-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Bezettingsgraad</p>
            <p className="text-3xl font-bold text-gray-100">{occupancyRate}%</p>
            <p className="text-xs text-gray-400 mt-1">
              {stats.occupiedSpaces} van {stats.totalSpaces} ruimtes bezet
            </p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Euro className="text-emerald-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Totale Omzet</p>
            <p className="text-3xl font-bold text-gray-100">
              €{stats.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              €{stats.paidRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} geïnd
            </p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <FileText className="text-amber-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Totaal Facturen</p>
            <p className="text-3xl font-bold text-gray-100">{stats.totalInvoices}</p>
            {stats.overdueInvoices > 0 && (
              <p className="text-xs text-red-600 mt-1">
                {stats.overdueInvoices} achterstallig
              </p>
            )}
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <CalendarDays className="text-blue-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Prognose Volgende Maand</p>
            <p className="text-3xl font-bold text-gray-100">
              €{stats.forecastNextMonth.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Op basis van actieve contracten
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-dark-700 rounded-lg">
              <TrendingUp className="text-gold-500" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-100">Inningspercentage</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-300">Betalingsinning</span>
                <span className="text-sm font-semibold text-gray-100">{collectionRate}%</span>
              </div>
              <div className="w-full bg-dark-800 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-gold-500 to-gold-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${collectionRate}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 bg-dark-800 rounded-lg">
                <p className="text-xs text-green-400 mb-1">Geïnd</p>
                <p className="text-lg font-bold text-green-400">
                  €{stats.paidRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-dark-800 rounded-lg">
                <p className="text-xs text-amber-400 mb-1">Uitstaand</p>
                <p className="text-lg font-bold text-amber-400">
                  €{stats.pendingAmount.toFixed(2)}
                </p>
              </div>
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
            {notifications.map((notification, index) => (
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
