import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Euro, FileText, DollarSign, Calendar, Download, Users, BarChart3, Table, LineChart as LineChartIcon, Database } from 'lucide-react';
import { BookingOverview } from './BookingOverview';
import { EBoekhoudenDashboard } from './EBoekhoudenDashboard';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  leaseRevenue: number;
  meetingRoomRevenue: number;
  leaseInvoices: number;
  meetingRoomInvoices: number;
};

type YearlyData = {
  year: number;
  revenue: number;
  paid: number;
  pending: number;
  invoices: number;
};

type QuarterlyData = {
  year: number;
  quarter: number;
  revenue: number;
  paid: number;
  pending: number;
  invoices: number;
};

type VATData = {
  period: string;
  vatCollected: number;
  vatPaid: number;
  netVAT: number;
  revenue: number;
  vatRate: number;
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
    averageInvoiceAmount: 0,
    leaseRevenue: 0,
    meetingRoomRevenue: 0,
    leaseInvoices: 0,
    meetingRoomInvoices: 0
  });
  const [yearlyData, setYearlyData] = useState<YearlyData[]>([]);
  const [quarterlyData, setQuarterlyData] = useState<QuarterlyData[]>([]);
  const [vatData, setVATData] = useState<VATData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<any[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{id: string; type: 'tenant' | 'external'; name: string} | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'vat' | 'eboekhouden'>('overview');
  const [yearlyView, setYearlyView] = useState<'table' | 'chart'>('table');
  const [quarterlyView, setQuarterlyView] = useState<'table' | 'chart'>('table');
  const [vatView, setVatView] = useState<'table' | 'chart'>('table');

  useEffect(() => {
    loadAllData();
  }, [selectedYear]);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('id, company_name')
      .order('company_name');

    const { data: externalData } = await supabase
      .from('external_customers')
      .select('id, company_name')
      .order('company_name');

    setTenants(tenantsData || []);
    setExternalCustomers(externalData || []);
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadAnalyticsStats(),
      loadYearlyData(),
      loadQuarterlyData(),
      loadVATData()
    ]);
    setLoading(false);
  };

  const loadAnalyticsStats = async () => {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('amount, status, due_date, lease_id, tenant_id');

    const { data: leaseSpaces } = await supabase
      .from('lease_spaces')
      .select('monthly_rent, lease_id, leases!inner(status, start_date, end_date)');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const totalRevenue = invoices?.filter(inv => inv.status !== 'credited')
      .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
    const paidRevenue = invoices?.filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
    const pendingAmount = invoices?.filter(inv => inv.status !== 'paid' && inv.status !== 'credited')
      .reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

    const paidInvoices = invoices?.filter(inv => inv.status === 'paid').length || 0;
    const pendingInvoices = invoices?.filter(inv => inv.status !== 'paid' && inv.status !== 'credited').length || 0;
    const overdueInvoices = invoices?.filter(
      inv => inv.status !== 'paid' && inv.status !== 'credited' && inv.due_date < todayStr
    ).length || 0;

    const overdueAmount = invoices?.filter(
      inv => inv.status !== 'paid' && inv.status !== 'credited' && inv.due_date < todayStr
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

    const nonCreditedInvoices = invoices?.filter(inv => inv.status !== 'credited') || [];
    const averageInvoiceAmount = nonCreditedInvoices.length > 0
      ? totalRevenue / nonCreditedInvoices.length
      : 0;

    const leaseInvoices = invoices?.filter(inv => inv.lease_id !== null) || [];
    const meetingRoomInvoices = invoices?.filter(inv => inv.lease_id === null) || [];

    const leaseRevenue = leaseInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const meetingRoomRevenue = meetingRoomInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

    setStats({
      totalRevenue,
      paidRevenue,
      pendingAmount,
      totalInvoices: nonCreditedInvoices.length,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      overdueAmount,
      forecastNextMonth,
      averageInvoiceAmount,
      leaseRevenue,
      meetingRoomRevenue,
      leaseInvoices: leaseInvoices.length,
      meetingRoomInvoices: meetingRoomInvoices.length
    });
  };

  const loadYearlyData = async () => {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_date, amount, status')
      .neq('status', 'credited');

    if (!invoices) return;

    const yearMap = new Map<number, YearlyData>();

    invoices.forEach(inv => {
      const year = new Date(inv.invoice_date).getFullYear();
      if (!yearMap.has(year)) {
        yearMap.set(year, {
          year,
          revenue: 0,
          paid: 0,
          pending: 0,
          invoices: 0
        });
      }

      const yearData = yearMap.get(year)!;
      yearData.revenue += Number(inv.amount);
      yearData.invoices += 1;
      if (inv.status === 'paid') {
        yearData.paid += Number(inv.amount);
      } else {
        yearData.pending += Number(inv.amount);
      }
    });

    const sortedYears = Array.from(yearMap.values()).sort((a, b) => b.year - a.year);
    setYearlyData(sortedYears);
  };

  const loadQuarterlyData = async () => {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_date, amount, status')
      .neq('status', 'credited');

    if (!invoices) return;

    const quarterMap = new Map<string, QuarterlyData>();

    invoices.forEach(inv => {
      const date = new Date(inv.invoice_date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const quarter = Math.floor(month / 3) + 1;
      const key = `${year}-Q${quarter}`;

      if (!quarterMap.has(key)) {
        quarterMap.set(key, {
          year,
          quarter,
          revenue: 0,
          paid: 0,
          pending: 0,
          invoices: 0
        });
      }

      const quarterData = quarterMap.get(key)!;
      quarterData.revenue += Number(inv.amount);
      quarterData.invoices += 1;
      if (inv.status === 'paid') {
        quarterData.paid += Number(inv.amount);
      } else {
        quarterData.pending += Number(inv.amount);
      }
    });

    const sortedQuarters = Array.from(quarterMap.values())
      .filter(q => q.year === selectedYear)
      .sort((a, b) => a.quarter - b.quarter);
    setQuarterlyData(sortedQuarters);
  };

  const loadVATData = async () => {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_date, vat_amount, vat_rate, subtotal, status');

    if (!invoices) return;

    const monthMap = new Map<string, VATData>();

    invoices.forEach(inv => {
      const date = new Date(inv.invoice_date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          period: key,
          vatCollected: 0,
          vatPaid: 0,
          netVAT: 0,
          revenue: 0,
          vatRate: 0
        });
      }

      const monthData = monthMap.get(key)!;
      if (inv.status === 'paid') {
        monthData.vatCollected += Number(inv.vat_amount || 0);
        monthData.revenue += Number(inv.subtotal || 0);
      }
    });

    monthMap.forEach((value) => {
      value.netVAT = value.vatCollected - value.vatPaid;
    });

    const sortedVAT = Array.from(monthMap.values())
      .filter(v => v.period.startsWith(selectedYear.toString()))
      .sort((a, b) => a.period.localeCompare(b.period));
    setVATData(sortedVAT);
  };

  const exportToExcel = (type: 'yearly' | 'quarterly' | 'vat') => {
    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'yearly':
        csvContent = 'Jaar;Omzet;Betaald;Openstaand;Aantal Facturen\n';
        yearlyData.forEach(row => {
          csvContent += `${row.year};${row.revenue.toFixed(2).replace('.', ',')};${row.paid.toFixed(2).replace('.', ',')};${row.pending.toFixed(2).replace('.', ',')};${row.invoices}\n`;
        });
        filename = 'jaaroverzicht.csv';
        break;

      case 'quarterly':
        csvContent = 'Jaar;Kwartaal;Omzet;Betaald;Openstaand;Aantal Facturen\n';
        quarterlyData.forEach(row => {
          csvContent += `${row.year};Q${row.quarter};${row.revenue.toFixed(2).replace('.', ',')};${row.paid.toFixed(2).replace('.', ',')};${row.pending.toFixed(2).replace('.', ',')};${row.invoices}\n`;
        });
        filename = `kwartaaloverzicht-${selectedYear}.csv`;
        break;

      case 'vat':
        csvContent = 'Periode;BTW Geïnd;BTW Betaald;Netto BTW;Omzet\n';
        vatData.forEach(row => {
          csvContent += `${row.period};${row.vatCollected.toFixed(2).replace('.', ',')};${row.vatPaid.toFixed(2).replace('.', ',')};${row.netVAT.toFixed(2).replace('.', ',')};${row.revenue.toFixed(2).replace('.', ',')}\n`;
        });
        filename = `btw-overzicht-${selectedYear}.csv`;
        break;
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const collectionRate = stats.totalRevenue > 0
    ? ((stats.paidRevenue / stats.totalRevenue) * 100).toFixed(1)
    : 0;

  if (loading) {
    return <div className="text-center py-8 text-gray-300">Analytics laden...</div>;
  }

  const availableYears = yearlyData.map(y => y.year);

  return (
    <div className="h-full bg-dark-950 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Financiële Analyses</h1>
        <p className="text-gray-300">Overzicht van omzet en financiële prestaties</p>
      </div>

      <div className="sticky top-0 z-10 bg-dark-950 pb-2 mb-6">
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <BarChart3 size={20} />
              Omzet
            </button>
            <button
              onClick={() => setActiveTab('vat')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'vat'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <FileText size={20} />
              BTW Overzicht
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'bookings'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <Calendar size={20} />
              Boekingen
            </button>
            <button
              onClick={() => setActiveTab('eboekhouden')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'eboekhouden'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <Database size={20} />
              e-Boekhouden
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div>
          <div className="mb-6 flex justify-end">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Selecteer Jaar</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 bg-gray-800 text-gray-200 rounded-lg border border-gray-700"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
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
                {formatCurrency(stats.totalRevenue)}
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
                {formatCurrency(stats.paidRevenue)}
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
                {formatCurrency(stats.pendingAmount)}
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
                {formatCurrency(stats.forecastNextMonth)}
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
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-dark-700 rounded-lg">
                <Calendar className="text-gold-500" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-gray-100">Jaaroverzicht</h3>
            </div>
            <div className="flex gap-2">
              <div className="flex bg-dark-800 rounded-lg p-1">
                <button
                  onClick={() => setYearlyView('table')}
                  className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                    yearlyView === 'table' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Table size={16} />
                </button>
                <button
                  onClick={() => setYearlyView('chart')}
                  className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                    yearlyView === 'chart' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <LineChartIcon size={16} />
                </button>
              </div>
              <button
                onClick={() => exportToExcel('yearly')}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm"
              >
                <Download size={16} />
                Export
              </button>
            </div>
          </div>
          {yearlyData.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Geen data beschikbaar</p>
          ) : yearlyView === 'table' ? (
            <div className="space-y-3">
              {yearlyData.map((year) => (
                <div key={year.year} className="p-4 bg-dark-800 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-100 text-lg">{year.year}</span>
                    <span className="text-xl font-bold text-emerald-400">
                      {formatCurrency(year.revenue)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs">Betaald</p>
                      <p className="text-green-400 font-semibold">{formatCurrency(year.paid)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Openstaand</p>
                      <p className="text-amber-400 font-semibold">{formatCurrency(year.pending)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Facturen</p>
                      <p className="text-gray-200 font-semibold">{year.invoices}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={yearlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend wrapperStyle={{ color: '#9CA3AF' }} />
                <Line type="monotone" dataKey="revenue" name="Totale Omzet" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 5 }} />
                <Line type="monotone" dataKey="paid" name="Betaald" stroke="#34D399" strokeWidth={2} dot={{ fill: '#34D399', r: 4 }} />
                <Line type="monotone" dataKey="pending" name="Openstaand" stroke="#FBBF24" strokeWidth={2} dot={{ fill: '#FBBF24', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-dark-700 rounded-lg">
                <TrendingUp className="text-blue-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-gray-100">Kwartaaloverzicht {selectedYear}</h3>
            </div>
            <div className="flex gap-2">
              <div className="flex bg-dark-800 rounded-lg p-1">
                <button
                  onClick={() => setQuarterlyView('table')}
                  className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                    quarterlyView === 'table' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Table size={16} />
                </button>
                <button
                  onClick={() => setQuarterlyView('chart')}
                  className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                    quarterlyView === 'chart' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <LineChartIcon size={16} />
                </button>
              </div>
              <button
                onClick={() => exportToExcel('quarterly')}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm"
              >
                <Download size={16} />
                Export
              </button>
            </div>
          </div>
          {quarterlyData.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Geen data beschikbaar voor {selectedYear}</p>
          ) : quarterlyView === 'table' ? (
            <div className="space-y-3">
              {quarterlyData.map((quarter) => (
                <div key={`${quarter.year}-Q${quarter.quarter}`} className="p-4 bg-dark-800 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-100">Q{quarter.quarter} {quarter.year}</span>
                    <span className="text-lg font-bold text-blue-400">
                      {formatCurrency(quarter.revenue)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs">Betaald</p>
                      <p className="text-green-400 font-semibold">{formatCurrency(quarter.paid)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Openstaand</p>
                      <p className="text-amber-400 font-semibold">{formatCurrency(quarter.pending)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Facturen</p>
                      <p className="text-gray-200 font-semibold">{quarter.invoices}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={quarterlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="quarter"
                  stroke="#9CA3AF"
                  tickFormatter={(value) => `Q${value}`}
                />
                <YAxis stroke="#9CA3AF" tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                  labelFormatter={(value) => `Q${value} ${selectedYear}`}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend wrapperStyle={{ color: '#9CA3AF' }} />
                <Line type="monotone" dataKey="revenue" name="Totale Omzet" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} />
                <Line type="monotone" dataKey="paid" name="Betaald" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} />
                <Line type="monotone" dataKey="pending" name="Openstaand" stroke="#FBBF24" strokeWidth={2} dot={{ fill: '#FBBF24', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
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
                  {formatCurrency(stats.overdueAmount)}
                </span>
              </p>
              <p className="text-sm text-gray-400">
                Bekijk de facturen sectie voor meer details en neem contact op met huurders indien nodig.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'bookings' && (
        <div>
          <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-dark-700 rounded-lg">
                <Users className="text-gold-500" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-gray-100">Boekingsoverzicht per Klant</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Huurders</h4>
                <div className="space-y-2">
                  {tenants.length === 0 ? (
                    <p className="text-gray-400 text-sm">Geen huurders gevonden</p>
                  ) : (
                    tenants.map(tenant => (
                      <button
                        key={tenant.id}
                        onClick={() => setSelectedCustomer({ id: tenant.id, type: 'tenant', name: tenant.company_name })}
                        className="w-full text-left px-4 py-3 bg-dark-800 hover:bg-dark-700 text-gray-200 rounded-lg transition-colors border border-dark-700"
                      >
                        {tenant.company_name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Externe Klanten</h4>
                <div className="space-y-2">
                  {externalCustomers.length === 0 ? (
                    <p className="text-gray-400 text-sm">Geen externe klanten gevonden</p>
                  ) : (
                    externalCustomers.map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => setSelectedCustomer({ id: customer.id, type: 'external', name: customer.company_name })}
                        className="w-full text-left px-4 py-3 bg-dark-800 hover:bg-dark-700 text-gray-200 rounded-lg transition-colors border border-dark-700"
                      >
                        {customer.company_name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {selectedCustomer && (
            <BookingOverview
              customerId={selectedCustomer.id}
              customerType={selectedCustomer.type}
              customerName={selectedCustomer.name}
              onClose={() => setSelectedCustomer(null)}
            />
          )}
        </div>
      )}

      {activeTab === 'vat' && (
        <div>
          <div className="mb-6 flex justify-end">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Selecteer Jaar</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 bg-gray-800 text-gray-200 rounded-lg border border-gray-700"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-dark-700 rounded-lg">
                  <FileText className="text-emerald-400" size={20} />
                </div>
                <h3 className="text-lg font-semibold text-gray-100">BTW Overzicht {selectedYear}</h3>
              </div>
              <div className="flex gap-2">
                <div className="flex bg-dark-800 rounded-lg p-1">
                  <button
                    onClick={() => setVatView('table')}
                    className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                      vatView === 'table' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Table size={16} />
                  </button>
                  <button
                    onClick={() => setVatView('chart')}
                    className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${
                      vatView === 'chart' ? 'bg-gold-500 text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <LineChartIcon size={16} />
                  </button>
                </div>
                <button
                  onClick={() => exportToExcel('vat')}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm"
                >
                  <Download size={16} />
                  Export
                </button>
              </div>
            </div>
            {vatData.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Geen BTW data beschikbaar voor {selectedYear}</p>
            ) : vatView === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-dark-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Periode</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Omzet (excl. BTW)</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">BTW Geïnd</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">BTW Betaald</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Netto BTW</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {vatData.map((row) => (
                      <tr key={row.period} className="hover:bg-dark-800/50">
                        <td className="px-4 py-3 text-sm text-gray-300">{row.period}</td>
                        <td className="px-4 py-3 text-sm text-gray-200 text-right font-semibold">
                          {formatCurrency(row.revenue)}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-400 text-right font-semibold">
                          {formatCurrency(row.vatCollected)}
                        </td>
                        <td className="px-4 py-3 text-sm text-red-400 text-right font-semibold">
                          {formatCurrency(row.vatPaid)}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-400 text-right font-bold">
                          {formatCurrency(row.netVAT)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-dark-800 font-bold">
                      <td className="px-4 py-3 text-sm text-gray-100">Totaal</td>
                      <td className="px-4 py-3 text-sm text-gray-100 text-right">
                        {formatCurrency(vatData.reduce((sum, row) => sum + row.revenue, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-400 text-right">
                        {formatCurrency(vatData.reduce((sum, row) => sum + row.vatCollected, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-400 text-right">
                        {formatCurrency(vatData.reduce((sum, row) => sum + row.vatPaid, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-400 text-right">
                        {formatCurrency(vatData.reduce((sum, row) => sum + row.netVAT, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={vatData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="period"
                    stroke="#9CA3AF"
                    tickFormatter={(value) => value.split('-')[1]}
                  />
                  <YAxis stroke="#9CA3AF" tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ color: '#9CA3AF' }} />
                  <Line type="monotone" dataKey="revenue" name="Omzet (excl. BTW)" stroke="#6B7280" strokeWidth={2} dot={{ fill: '#6B7280', r: 4 }} />
                  <Line type="monotone" dataKey="vatCollected" name="BTW Geïnd" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} />
                  <Line type="monotone" dataKey="vatPaid" name="BTW Betaald" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 4 }} />
                  <Line type="monotone" dataKey="netVAT" name="Netto BTW" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {activeTab === 'eboekhouden' && (
        <div>
          <EBoekhoudenDashboard />
        </div>
      )}
    </div>
  );
}
