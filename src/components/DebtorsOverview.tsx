import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Euro, Calendar, AlertCircle, CheckCircle, FileText, Trash2, Eye, Filter, RefreshCw, Loader2, Database } from 'lucide-react';
import { resyncInvoiceToEBoekhouden } from '../lib/eboekhoudenSync';

const getInvoiceTypeColor = (invoice: any): string => {
  if (invoice.lease_id !== null && invoice.lease?.lease_type === 'flex') return 'text-purple-500';
  if (invoice.lease_id !== null) return 'text-green-500';
  if (invoice.notes?.includes('Flex werkplek boekingen')) return 'text-purple-500';
  if (invoice.notes?.includes('Vergaderruimte gebruik') || invoice.notes?.includes('Vergaderruimte boekingen') || invoice.notes?.includes('Vergaderruimte & Flex werkplek boekingen')) return 'text-blue-500';
  if (invoice.invoice_line_items?.some((item: any) => item.booking_id !== null)) return 'text-blue-500';
  return 'text-orange-500';
};

type Debtor = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  total_outstanding: number;
  oldest_invoice_date: string;
  invoice_count: number;
  overdue_count: number;
};

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  status: string;
};

type DebtorsOverviewProps = {
  initialTab?: 'open' | 'log';
};

export function DebtorsOverview({ initialTab = 'open' }: DebtorsOverviewProps) {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [debtorInvoices, setDebtorInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [activeTab, setActiveTab] = useState<'open' | 'log'>(initialTab);
  const [paidInvoices, setPaidInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [filterCustomer, setFilterCustomer] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState('');
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [showSyncedInvoices, setShowSyncedInvoices] = useState(false);
  const [syncedInvoices, setSyncedInvoices] = useState<any[]>([]);
  const [resyncingInvoiceId, setResyncingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadCompanySettings();
    if (activeTab === 'open') {
      loadDebtors();
    } else {
      loadPaidInvoices();
    }
  }, [activeTab]);

  const loadCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setCompanySettings(data);
  };

  const loadDebtors = async () => {
    setLoading(true);
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          amount,
          status,
          tenant_id,
          external_customer_id,
          tenants (id, name, company_name, email),
          external_customers (id, company_name, contact_name, email)
        `)
        .not('status', 'in', '(paid,credited)');

      if (error) throw error;

      const debtorMap = new Map<string, Debtor>();
      let total = 0;

      invoices?.forEach((invoice: any) => {
        if (!invoice.tenant_id && !invoice.external_customer_id) {
          return;
        }

        const customer = invoice.tenant_id && invoice.tenants
          ? {
              id: invoice.tenants.id,
              name: invoice.tenants.name,
              company_name: invoice.tenants.company_name,
              email: invoice.tenants.email
            }
          : invoice.external_customer_id && invoice.external_customers
          ? {
              id: invoice.external_customers.id,
              name: invoice.external_customers.contact_name,
              company_name: invoice.external_customers.company_name,
              email: invoice.external_customers.email
            }
          : null;

        if (!customer) return;

        if (!debtorMap.has(customer.id)) {
          debtorMap.set(customer.id, {
            id: customer.id,
            name: customer.name,
            company_name: customer.company_name,
            email: customer.email,
            total_outstanding: 0,
            oldest_invoice_date: invoice.invoice_date,
            invoice_count: 0,
            overdue_count: 0,
          });
        }

        const debtor = debtorMap.get(customer.id)!;
        debtor.total_outstanding += parseFloat(invoice.amount);
        debtor.invoice_count += 1;
        if (invoice.status === 'overdue') debtor.overdue_count += 1;
        if (invoice.invoice_date < debtor.oldest_invoice_date) {
          debtor.oldest_invoice_date = invoice.invoice_date;
        }

        total += parseFloat(invoice.amount);
      });

      const debtorsList = Array.from(debtorMap.values())
        .sort((a, b) => b.total_outstanding - a.total_outstanding);

      setDebtors(debtorsList);
      setTotalOutstanding(total);
    } catch (error) {
      console.error('Error loading debtors:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDebtorInvoices = async (debtorId: string, debtor: Debtor) => {
    setSelectedDebtor(debtor);
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, amount, status, lease_id, notes, lease:leases(lease_type), invoice_line_items(booking_id)')
        .or(`tenant_id.eq.${debtorId},external_customer_id.eq.${debtorId}`)
        .not('status', 'in', '(paid,credited)')
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setDebtorInvoices(invoices || []);
    } catch (error) {
      console.error('Error loading debtor invoices:', error);
    }
  };

  const loadPaidInvoices = async () => {
    setLoading(true);
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          amount,
          subtotal,
          vat_amount,
          vat_rate,
          vat_inclusive,
          status,
          invoice_month,
          notes,
          lease_id,
          tenant_id,
          external_customer_id,
          applied_credit,
          lease:leases(lease_type),
          invoice_line_items (
            id,
            description,
            quantity,
            unit_price,
            amount,
            booking_id
          )
        `)
        .in('status', ['paid', 'credited'])
        .order('invoice_date', { ascending: false });

      if (error) {
        console.error('Error loading paid invoices:', error);
        throw error;
      }

      console.log('Loaded paid invoices:', invoices?.length || 0);

      const invoicesWithCustomers = await Promise.all(
        (invoices || []).map(async (invoice) => {
          let customerData = null;

          if (invoice.tenant_id) {
            const { data: tenant, error: tenantError } = await supabase
              .from('tenants')
              .select('id, name, company_name, email')
              .eq('id', invoice.tenant_id)
              .maybeSingle();

            if (tenantError) {
              console.error('Error loading tenant:', tenantError);
            }

            customerData = tenant ? { tenants: tenant } : null;
          } else if (invoice.external_customer_id) {
            const { data: extCustomer, error: customerError } = await supabase
              .from('external_customers')
              .select('id, company_name, contact_name, email')
              .eq('id', invoice.external_customer_id)
              .maybeSingle();

            if (customerError) {
              console.error('Error loading external customer:', customerError);
            }

            customerData = extCustomer ? { external_customers: extCustomer } : null;
          }

          return {
            ...invoice,
            ...customerData,
            line_items: invoice.invoice_line_items || []
          };
        })
      );

      console.log('Invoices with customers:', invoicesWithCustomers.length);
      setPaidInvoices(invoicesWithCustomers);
    } catch (error) {
      console.error('Error loading paid invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    setInvoiceToDelete(invoiceId);
    setShowDeleteModal(true);
    setDeleteCode('');
  };

  const loadSyncedInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, amount, eboekhouden_factuur_id, eboekhouden_synced_at')
      .not('eboekhouden_factuur_id', 'is', null)
      .order('eboekhouden_synced_at', { ascending: false })
      .limit(20);
    setSyncedInvoices(data || []);
  };

  const handleResyncInvoice = async (invoiceId: string) => {
    if (!companySettings?.eboekhouden_api_token) return;
    setResyncingInvoiceId(invoiceId);
    const result = await resyncInvoiceToEBoekhouden(companySettings.eboekhouden_api_token, invoiceId, companySettings);
    setResyncingInvoiceId(null);
    if (result.success) {
      await loadSyncedInvoices();
    }
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    if (deleteCode !== companySettings?.delete_code) {
      alert('Onjuiste verwijdercode!');
      return;
    }

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceToDelete);

      if (error) throw error;

      await loadPaidInvoices();
      setShowDeleteModal(false);
      setInvoiceToDelete(null);
      setDeleteCode('');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Fout bij verwijderen van factuur. Probeer het opnieuw.');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nl-NL');
  };

  const getDaysOverdue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getFilteredPaidInvoices = () => {
    let filtered = [...paidInvoices];

    if (filterCustomer) {
      filtered = filtered.filter(invoice => {
        const customerName = invoice.tenants?.company_name || invoice.external_customers?.company_name || '';
        return customerName === filterCustomer;
      });
    }

    if (filterPeriod) {
      filtered = filtered.filter(invoice => invoice.invoice_month === filterPeriod);
    }

    filtered.sort((a, b) => {
      return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
    });

    return filtered;
  };

  const getUniqueCustomers = () => {
    const customers = paidInvoices.map(invoice => {
      return invoice.tenants?.company_name || invoice.external_customers?.company_name || '';
    }).filter(name => name !== '');
    return [...new Set(customers)].sort();
  };

  const getUniquePeriods = () => {
    const periods = paidInvoices
      .filter(invoice => {
        if (filterCustomer) {
          const customerName = invoice.tenants?.company_name || invoice.external_customers?.company_name || '';
          return customerName === filterCustomer && invoice.invoice_month;
        }
        return invoice.invoice_month;
      })
      .map(invoice => invoice.invoice_month);
    return [...new Set(periods)].sort().reverse();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-950 overflow-hidden">
      <div className="flex-shrink-0 mb-6">
        {activeTab === 'open' && (
          <div className="flex items-center gap-4">
            <div className="bg-dark-900 px-4 py-2 rounded-lg">
              <div className="text-sm text-gray-400">Totaal Openstaand</div>
              <div className="text-2xl font-bold text-yellow-500">{formatCurrency(totalOutstanding)}</div>
            </div>
            <div className="bg-dark-900 px-4 py-2 rounded-lg">
              <div className="text-sm text-gray-400">Aantal Debiteuren</div>
              <div className="text-2xl font-bold text-gray-100">{debtors.length}</div>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'open' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
          <div className="bg-dark-900 rounded-lg overflow-hidden flex flex-col">
            <div className="p-4 bg-dark-800 border-b border-dark-700 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-100">Debiteuren</h2>
            </div>
            <div className="overflow-y-auto flex-1">
              {debtors.length === 0 ? (
                <div className="bg-dark-900 rounded-lg p-8 text-center">
                  <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                  <p className="text-gray-400">Geen openstaande debiteuren</p>
                </div>
              ) : (
                <div className="divide-y divide-dark-700">
                  {debtors.map((debtor) => (
                    <button
                      key={debtor.id}
                      onClick={() => loadDebtorInvoices(debtor.id, debtor)}
                      className={`w-full p-4 text-left hover:bg-dark-800/50 transition-colors ${
                        selectedDebtor?.id === debtor.id ? 'bg-dark-800' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-gray-100">{debtor.company_name}</div>
                          <div className="text-sm text-gray-400">{debtor.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-yellow-500">{formatCurrency(debtor.total_outstanding)}</div>
                          {debtor.overdue_count > 0 && (
                            <div className="text-xs text-red-400 flex items-center gap-1 justify-end">
                              <AlertCircle size={12} />
                              {debtor.overdue_count} verlopen
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-400">
                        <span>{debtor.invoice_count} facturen</span>
                        <span>Oudste: {formatDate(debtor.oldest_invoice_date)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-dark-900 rounded-lg overflow-hidden flex flex-col">
            <div className="p-4 bg-dark-800 border-b border-dark-700 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-100">
                {selectedDebtor ? `Facturen - ${selectedDebtor.company_name}` : 'Selecteer een debiteur'}
              </h2>
            </div>
            <div className="overflow-y-auto flex-1">
              {!selectedDebtor ? (
                <div className="bg-dark-900 rounded-lg p-8 text-center">
                  <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">Selecteer een debiteur om facturen te bekijken</p>
                </div>
              ) : debtorInvoices.length === 0 ? (
                <div className="bg-dark-900 rounded-lg p-8 text-center">
                  <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                  <p className="text-gray-400">Geen openstaande facturen voor deze debiteur</p>
                </div>
              ) : (
                <div className="divide-y divide-dark-700">
                  {debtorInvoices.map((invoice) => {
                    const daysOverdue = getDaysOverdue(invoice.due_date);
                    const isOverdue = daysOverdue > 0;

                    return (
                      <div key={invoice.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className={`font-semibold ${getInvoiceTypeColor(invoice)}`}>{invoice.invoice_number}</div>
                            <div className="text-sm text-gray-400 flex items-center gap-1">
                              <Calendar size={14} />
                              Factuurdatum: {formatDate(invoice.invoice_date)}
                            </div>
                            <div className={`text-sm flex items-center gap-1 ${
                              isOverdue ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              <Calendar size={14} />
                              Vervaldatum: {formatDate(invoice.due_date)}
                              {isOverdue && ` (${daysOverdue} dagen)`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-yellow-500 flex items-center gap-1">
                              <Euro size={16} />
                              {formatCurrency(invoice.amount)}
                            </div>
                            {isOverdue && (
                              <div className="text-xs text-red-400 font-semibold flex items-center gap-1 justify-end mt-1">
                                <AlertCircle size={12} />
                                VERLOPEN
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'log' && (
        <div className="flex-1 flex flex-col bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
            <h2 className="text-lg font-bold text-gray-100 px-4 py-3 bg-dark-800 border-b border-amber-500 flex-shrink-0">
              Facturen Logboek (Betaald & Gecrediteerd)
            </h2>
            {paidInvoices.length === 0 ? (
              <div className="bg-dark-900 rounded-lg p-8 text-center">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                <p className="text-gray-400">Geen betaalde of gecrediteerde facturen gevonden</p>
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-4 py-3 bg-dark-800 border-b border-dark-700 flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Filter size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-400 font-medium">Filteren:</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400">Klant:</label>
                      <select
                        value={filterCustomer}
                        onChange={(e) => {
                          setFilterCustomer(e.target.value);
                          setFilterPeriod('');
                        }}
                        className="bg-dark-700 border border-dark-600 text-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 min-w-[200px]"
                      >
                        <option value="">Alle klanten</option>
                        {getUniqueCustomers().map((customer) => (
                          <option key={customer} value={customer}>
                            {customer}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400">Periode:</label>
                      <select
                        value={filterPeriod}
                        onChange={(e) => setFilterPeriod(e.target.value)}
                        className="bg-dark-700 border border-dark-600 text-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 min-w-[150px]"
                        disabled={!filterCustomer && getUniquePeriods().length === 0}
                      >
                        <option value="">Alle periodes</option>
                        {getUniquePeriods().map((period) => (
                          <option key={period} value={period}>
                            {period}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(filterCustomer || filterPeriod) && (
                      <button
                        onClick={() => {
                          setFilterCustomer('');
                          setFilterPeriod('');
                        }}
                        className="text-sm text-gold-400 hover:text-gold-300 underline ml-auto"
                      >
                        Filters wissen
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 mt-2">
                    {getFilteredPaidInvoices().length} van {paidInvoices.length} facturen
                  </div>

                  <div className="mt-3 p-3 bg-dark-700/50 rounded-lg border border-dark-600">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={14} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-300 uppercase">Legende Factuurnummers</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-gray-400">Huurcontract</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-gray-400">Vergaderruimte</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        <span className="text-gray-400">Flex werkplek</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span className="text-gray-400">Handmatig</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full table-fixed min-w-[1100px]">
                    <thead>
                      <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                        <th className="text-left px-4 py-3 font-semibold w-[16%]">Klant</th>
                        <th className="text-left px-4 py-3 font-semibold w-[10%]">Factuur Nr.</th>
                        <th className="text-left px-4 py-3 font-semibold w-[10%]">Maand</th>
                        <th className="text-left px-4 py-3 font-semibold w-[12%]">Factuur Datum</th>
                        <th className="text-left px-4 py-3 font-semibold w-[12%]">Vervaldatum</th>
                        <th className="text-right px-4 py-3 font-semibold w-[10%]">Bedrag</th>
                        <th className="text-center px-4 py-3 font-semibold w-[10%]">Status</th>
                        <th className="text-center px-4 py-3 font-semibold w-[10%]">Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredPaidInvoices().map((invoice: any) => {
                      const customer = invoice.tenant_id && invoice.tenants
                        ? invoice.tenants
                        : invoice.external_customer_id && invoice.external_customers
                        ? invoice.external_customers
                        : null;
                      const displayName = customer?.company_name || 'Onbekende klant';

                      return (
                        <tr key={invoice.id} className="border-b border-dark-800 hover:bg-dark-800 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="text-gray-500" size={18} />
                              <span className="text-gray-100 font-medium">{displayName}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-3 ${getInvoiceTypeColor(invoice)} font-medium text-sm`}>
                            {invoice.invoice_number.replace(/^INV-/, '')}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            {invoice.invoice_month ? (
                              (() => {
                                const [year, month] = invoice.invoice_month.split('-');
                                const monthNames = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
                                return `${monthNames[parseInt(month) - 1]} ${year}`;
                              })()
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            {formatDate(invoice.invoice_date)}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar size={14} className="text-gold-500" />
                              {formatDate(invoice.due_date)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="text-gray-100 font-bold">
                              €{invoice.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {invoice.status === 'credited' && invoice.applied_credit && (
                              <div className="text-xs text-green-400 mt-1">
                                -€{invoice.applied_credit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credit
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {invoice.status === 'credited' ? (
                              <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-purple-900 text-purple-400">
                                GECREDITEERD
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-400">
                                BETAALD
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => setSelectedInvoice(invoice)}
                                className="inline-flex items-center justify-center p-2 bg-blue-900 hover:bg-blue-800 text-blue-300 rounded-lg transition-colors"
                                title="Factuur bekijken"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteInvoice(invoice.id)}
                                className="inline-flex items-center justify-center p-2 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg transition-colors"
                                title="Factuur verwijderen"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>

                {companySettings?.eboekhouden_connected && (
                  <div className="px-4 py-4 bg-dark-800 border-t border-dark-700 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Database size={16} className="text-gold-500" />
                        <h4 className="text-sm font-semibold text-gray-300 uppercase">e-Boekhouden Synchronisatie</h4>
                      </div>
                      <button
                        onClick={() => {
                          loadSyncedInvoices();
                          setShowSyncedInvoices(!showSyncedInvoices);
                        }}
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        {showSyncedInvoices ? 'Verbergen' : 'Tonen'}
                      </button>
                    </div>

                    {showSyncedInvoices && (
                      <div className="bg-dark-900 rounded-lg border border-dark-600 overflow-hidden">
                        {syncedInvoices.length > 0 ? (
                          <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-dark-700 sticky top-0">
                                <tr>
                                  <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Factuurnr.</th>
                                  <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Datum</th>
                                  <th className="text-right px-4 py-2.5 text-gray-400 font-medium">Bedrag</th>
                                  <th className="text-left px-4 py-2.5 text-gray-400 font-medium">e-Boekhouden ID</th>
                                  <th className="text-right px-4 py-2.5 text-gray-400 font-medium">Sync</th>
                                  <th className="w-10"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {syncedInvoices.map((inv) => (
                                  <tr key={inv.id} className="border-t border-dark-700 hover:bg-dark-700/30">
                                    <td className="px-4 py-2 text-gray-200 font-mono">{inv.invoice_number}</td>
                                    <td className="px-4 py-2 text-gray-300">{new Date(inv.invoice_date).toLocaleDateString('nl-NL')}</td>
                                    <td className="px-4 py-2 text-right text-gray-200">€{Number(inv.amount).toFixed(2)}</td>
                                    <td className="px-4 py-2 text-gray-400 font-mono">{inv.eboekhouden_factuur_id}</td>
                                    <td className="px-4 py-2 text-right text-xs text-gray-500">
                                      {new Date(inv.eboekhouden_synced_at).toLocaleDateString('nl-NL')}
                                    </td>
                                    <td className="px-2 py-2">
                                      <button
                                        onClick={() => handleResyncInvoice(inv.id)}
                                        disabled={resyncingInvoiceId === inv.id}
                                        className="p-1 text-gray-400 hover:text-gold-500 transition-colors disabled:opacity-50"
                                        title="Opnieuw synchroniseren"
                                      >
                                        {resyncingInvoiceId === inv.id ? (
                                          <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                          <RefreshCw size={14} />
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="py-8 text-center text-gray-500">
                            <FileText size={24} className="mx-auto mb-2 opacity-40" />
                            <p className="text-sm">Geen gesynchroniseerde facturen</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-dark-700">
            <div className="sticky top-0 bg-dark-800 px-6 py-4 border-b border-dark-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-100">
                Factuur <span className={getInvoiceTypeColor(selectedInvoice)}>{selectedInvoice.invoice_number.replace(/^INV-/, '')}</span>
              </h3>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Klant</label>
                  <p className="text-gray-100 font-medium">
                    {selectedInvoice.tenants?.company_name ||
                     selectedInvoice.external_customers?.company_name ||
                     'Onbekende klant'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Status</label>
                  <p>
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-400">
                      BETAALD
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Factuur Datum</label>
                  <p className="text-gray-100">{formatDate(selectedInvoice.invoice_date)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Vervaldatum</label>
                  <p className="text-gray-100">{formatDate(selectedInvoice.due_date)}</p>
                </div>
                {selectedInvoice.invoice_month && (
                  <div>
                    <label className="text-sm text-gray-400">Factuurmaand</label>
                    <p className="text-gray-100">
                      {(() => {
                        const [year, month] = selectedInvoice.invoice_month.split('-');
                        const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
                        return `${monthNames[parseInt(month) - 1]} ${year}`;
                      })()}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-dark-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Factuurregels</h4>
                <div className="space-y-2">
                  {selectedInvoice.line_items && selectedInvoice.line_items.length > 0 ? (
                    selectedInvoice.line_items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start p-3 bg-dark-800 rounded-lg">
                        <div className="flex-1">
                          <p className="text-gray-100 font-medium">{item.description}</p>
                          {item.quantity && (
                            <p className="text-xs text-gray-400 mt-1">
                              Aantal: {item.quantity} × €{item.unit_price?.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-gray-100 font-semibold">
                            €{item.amount?.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-sm">Geen factuurregels beschikbaar</p>
                  )}
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4 space-y-2">
                <div className="flex justify-between text-gray-300">
                  <span>Subtotaal</span>
                  <span>€{selectedInvoice.subtotal?.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>BTW ({selectedInvoice.vat_rate}%)</span>
                  <span>€{selectedInvoice.vat_amount?.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-100 pt-2 border-t border-dark-700">
                  <span>Totaal</span>
                  <span>€{selectedInvoice.amount?.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="border-t border-dark-700 pt-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Notities</h4>
                  <p className="text-gray-100 text-sm">{selectedInvoice.notes}</p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 max-w-md w-full mx-4 border border-dark-700">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Factuur Wissen</h3>
            <p className="text-gray-300 mb-4">
              Weet je zeker dat je deze betaalde factuur wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Voer code in:
              </label>
              <input
                type="password"
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value)}
                placeholder="Voer verwijdercode in"
                className="w-full px-3 py-2 bg-dark-800 border border-amber-500 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    confirmDeleteInvoice();
                  }
                }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setInvoiceToDelete(null);
                  setDeleteCode('');
                }}
                className="flex-1 px-4 py-2 border border-dark-600 text-gray-200 rounded-lg hover:bg-dark-800 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={confirmDeleteInvoice}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Wissen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
