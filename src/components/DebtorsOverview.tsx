import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Euro, Calendar, AlertCircle, CheckCircle, FileText } from 'lucide-react';

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

export function DebtorsOverview() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [debtorInvoices, setDebtorInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [activeTab, setActiveTab] = useState<'open' | 'log'>('open');
  const [paidInvoices, setPaidInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'open') {
      loadDebtors();
    } else {
      loadPaidInvoices();
    }
  }, [activeTab]);

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
        .neq('status', 'paid');

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
        .select('id, invoice_number, invoice_date, due_date, amount, status')
        .or(`tenant_id.eq.${debtorId},external_customer_id.eq.${debtorId}`)
        .neq('status', 'paid')
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
          status,
          invoice_month,
          tenant_id,
          external_customer_id,
          tenants (id, name, company_name, email),
          external_customers (id, company_name, contact_name, email)
        `)
        .eq('status', 'paid')
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setPaidInvoices(invoices || []);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-dark-950">
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100 mb-4">Debiteuren Overzicht</h1>
          <div className="flex gap-2 mb-4 border-b border-dark-700">
            <button
              onClick={() => setActiveTab('open')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 ${
                activeTab === 'open'
                  ? 'text-gold-500 border-gold-500'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              <AlertCircle size={18} />
              Openstaand
            </button>
            <button
              onClick={() => setActiveTab('log')}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 ${
                activeTab === 'log'
                  ? 'text-gold-500 border-gold-500'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              <CheckCircle size={18} />
              Logboek
            </button>
          </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-dark-900 rounded-lg overflow-hidden">
            <div className="p-4 bg-dark-800 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-gray-100">Debiteuren</h2>
            </div>
            <div className="overflow-auto max-h-[600px]">
              {debtors.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
                  <p>Geen openstaande facturen</p>
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

          <div className="bg-dark-900 rounded-lg overflow-hidden">
            <div className="p-4 bg-dark-800 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-gray-100">
                {selectedDebtor ? `Facturen - ${selectedDebtor.company_name}` : 'Selecteer een debiteur'}
              </h2>
            </div>
            <div className="overflow-auto max-h-[600px]">
              {!selectedDebtor ? (
                <div className="p-8 text-center text-gray-400">
                  Selecteer een debiteur om facturen te bekijken
                </div>
              ) : debtorInvoices.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  Geen openstaande facturen voor deze debiteur
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
                            <div className="font-semibold text-gray-100">{invoice.invoice_number}</div>
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
          <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
            <h2 className="text-lg font-bold text-gray-100 px-4 py-3 bg-dark-800 border-b border-amber-500">
              Betaalde Facturen (Logboek)
            </h2>
            {paidInvoices.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                Geen betaalde facturen gevonden.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                      <th className="text-left px-4 py-3 font-semibold w-[18%]">Klant</th>
                      <th className="text-left px-4 py-3 font-semibold w-[10%]">Factuur Nr.</th>
                      <th className="text-left px-4 py-3 font-semibold w-[10%]">Maand</th>
                      <th className="text-left px-4 py-3 font-semibold w-[12%]">Factuur Datum</th>
                      <th className="text-left px-4 py-3 font-semibold w-[12%]">Vervaldatum</th>
                      <th className="text-right px-4 py-3 font-semibold w-[10%]">Bedrag</th>
                      <th className="text-center px-4 py-3 font-semibold w-[10%]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidInvoices.map((invoice: any) => {
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
                          <td className="px-4 py-3 text-purple-600 font-medium text-sm">
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
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-400">
                              BETAALD
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
