import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Euro, FileText, DollarSign, Calendar } from 'lucide-react';

type AnalyticsStats = {
  totalRevenue: number;
  paidRevenue: number;
  pendingAmount: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  overdueAmount: number;
  forecastNextMonth: number;
  averageInvoiceAmount: number;
};

export function Analytics() {
  const [stats, setStats] = useState<AnalyticsStats>({
    totalRevenue: 0,
    paidRevenue: 0,
    pendingAmount: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    overdueAmount: 0,
    forecastNextMonth: 0,
    averageInvoiceAmount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsStats();
  }, []);

  const loadAnalyticsStats = async () => {
    setLoading(true);

    const { data: invoices } = await supabase
      .from('invoices')
      .select('amount, status, due_date');

    const { data: leaseSpaces } = await supabase
      .from('lease_spaces')
      .select('monthly_rent, lease_id, leases!inner(status, start_date, end_date)');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
    const paidRevenue = invoices?.filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
    const pendingAmount = invoices?.filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

    const paidInvoices = invoices?.filter(inv => inv.status === 'paid').length || 0;
    const pendingInvoices = invoices?.filter(inv => inv.status === 'pending').length || 0;
    const overdueInvoices = invoices?.filter(
      inv => inv.status !== 'paid' && inv.due_date < todayStr
    ).length || 0;

    const overdueAmount = invoices?.filter(
      inv => inv.status !== 'paid' && inv.due_date < todayStr
    ).reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

    const activeLeaseSpaces = leaseSpaces?.filter(ls => {
      const lease = ls.leases;
      return lease.status === 'active' &&
             lease.start_date <= todayStr &&
             lease.end_date >= todayStr;
    }) || [];

    const forecastNextMonth = activeLeaseSpaces.reduce((sum, ls) =>
      sum + Number(ls.monthly_rent), 0
    );

    const averageInvoiceAmount = invoices && invoices.length > 0
      ? totalRevenue / invoices.length
      : 0;

    setStats({
      totalRevenue,
      paidRevenue,
      pendingAmount,
      totalInvoices: invoices?.length || 0,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      overdueAmount,
      forecastNextMonth,
      averageInvoiceAmount
    });

    setLoading(false);
  };

  const collectionRate = stats.totalRevenue > 0
    ? ((stats.paidRevenue / stats.totalRevenue) * 100).toFixed(1)
    : 0;

  if (loading) {
    return <div className="text-center py-8 text-gray-300">Analytics laden...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Financiële Analyses</h1>
        <p className="text-gray-300">Overzicht van omzet en financiële prestaties</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Euro className="text-emerald-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Totale Omzet</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">
                €{stats.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              Alle facturen
            </p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <DollarSign className="text-green-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Geïnde Omzet</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">
                €{stats.paidRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              {stats.paidInvoices} betaalde facturen
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
            <p className="text-sm text-gray-300 mb-1">Uitstaand Bedrag</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">
                €{stats.pendingAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              {stats.pendingInvoices} openstaande facturen
            </p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-dark-700 rounded-lg">
              <Calendar className="text-blue-400" size={24} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-1">Prognose Volgende Maand</p>
            <div className="h-12 flex items-center">
              <p className="text-3xl font-bold text-gray-100">
                €{stats.forecastNextMonth.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-1 h-5">
              Actieve contracten
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
                  €{stats.pendingAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-dark-700 rounded-lg">
              <FileText className="text-blue-400" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-100">Factuur Overzicht</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-dark-800 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Totaal Facturen</p>
                <p className="text-2xl font-bold text-gray-100">{stats.totalInvoices}</p>
              </div>
              <div className="p-4 bg-dark-800 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Gemiddeld Bedrag</p>
                <p className="text-2xl font-bold text-gray-100">
                  €{stats.averageInvoiceAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg">
                <p className="text-xs text-green-400 mb-1">Betaald</p>
                <p className="text-xl font-bold text-green-400">{stats.paidInvoices}</p>
              </div>
              <div className="p-3 bg-amber-900/30 border border-amber-800 rounded-lg">
                <p className="text-xs text-amber-400 mb-1">Openstaand</p>
                <p className="text-xl font-bold text-amber-400">{stats.pendingInvoices}</p>
              </div>
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-xs text-red-400 mb-1">Achterstallig</p>
                <p className="text-xl font-bold text-red-400">{stats.overdueInvoices}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {stats.overdueInvoices > 0 && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="text-red-400" size={24} />
            <h3 className="text-lg font-semibold text-red-400">Achterstallige Betalingen</h3>
          </div>
          <p className="text-gray-300 mb-4">
            Er zijn momenteel {stats.overdueInvoices} achterstallige factu{stats.overdueInvoices !== 1 ? 'ren' : 'ur'} met een totaalbedrag van{' '}
            <span className="font-bold text-red-400">
              €{stats.overdueAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>
          <p className="text-sm text-gray-400">
            Bekijk de facturen sectie voor meer details en neem contact op met huurders indien nodig.
          </p>
        </div>
      )}
    </div>
  );
}
