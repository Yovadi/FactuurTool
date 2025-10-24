import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building, Users, FileText, TrendingUp, AlertCircle, Euro } from 'lucide-react';

type DashboardStats = {
  totalTenants: number;
  totalSpaces: number;
  occupiedSpaces: number;
  totalInvoices: number;
  totalRevenue: number;
  paidRevenue: number;
  overdueInvoices: number;
  pendingAmount: number;
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
    pendingAmount: 0
  });
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

    const occupiedSpaces = spaces?.filter(s => !s.is_available).length || 0;

    const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
    const paidRevenue = invoices?.filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

    const today = new Date().toISOString().split('T')[0];
    const overdueInvoices = invoices?.filter(
      inv => inv.status !== 'paid' && inv.due_date < today
    ).length || 0;

    const pendingAmount = invoices?.filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

    setStats({
      totalTenants: tenants?.length || 0,
      totalSpaces: spaces?.length || 0,
      occupiedSpaces,
      totalInvoices: invoices?.length || 0,
      totalRevenue,
      paidRevenue,
      overdueInvoices,
      pendingAmount
    });

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
            {stats.overdueInvoices > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-900 rounded-lg">
                <AlertCircle className="text-red-400 mt-0.5" size={18} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">Achterstallige Facturen</p>
                  <p className="text-xs text-red-300 mt-0.5">
                    {stats.overdueInvoices} factu{stats.overdueInvoices !== 1 ? 'ren' : 'ur'} over de vervaldatum
                  </p>
                </div>
              </div>
            )}

            {stats.totalSpaces - stats.occupiedSpaces > 0 && (
              <div className="flex items-start gap-3 p-3 bg-dark-800 rounded-lg">
                <Building className="text-gold-500 mt-0.5" size={18} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-100">Beschikbare Ruimtes</p>
                  <p className="text-xs text-gold-400 mt-0.5">
                    {stats.totalSpaces - stats.occupiedSpaces} ruimte{stats.totalSpaces - stats.occupiedSpaces !== 1 ? 's' : ''} beschikbaar voor verhuur
                  </p>
                </div>
              </div>
            )}

            {stats.overdueInvoices === 0 && stats.totalSpaces === stats.occupiedSpaces && (
              <div className="flex items-start gap-3 p-3 bg-green-900 rounded-lg">
                <TrendingUp className="text-green-400 mt-0.5" size={18} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400">Alles in Orde</p>
                  <p className="text-xs text-green-300 mt-0.5">
                    Geen achterstallige facturen en volledige bezetting
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
