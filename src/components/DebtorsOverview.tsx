import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Euro, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

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

  useEffect(() => {
    loadDebtors();
  }, []);

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
        .in('status', ['sent', 'overdue']);

      if (error) throw error;

      const debtorMap = new Map<string, Debtor>();
      let total = 0;

      invoices?.forEach((invoice: any) => {
        const customer = invoice.tenant_id
          ? {
              id: invoice.tenants.id,
              name: invoice.tenants.name,
              company_name: invoice.tenants.company_name,
              email: invoice.tenants.email
            }
          : {
              id: invoice.external_customers.id,
              name: invoice.external_customers.contact_name,
              company_name: invoice.external_customers.company_name,
              email: invoice.external_customers.email
            };

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
        .in('status', ['sent', 'overdue'])
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setDebtorInvoices(invoices || []);
    } catch (error) {
      console.error('Error loading debtor invoices:', error);
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
    <div className="h-full bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Debiteuren Overzicht</h1>
          <div className="flex items-center gap-4">
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <div className="text-sm text-gray-400">Totaal Openstaand</div>
              <div className="text-2xl font-bold text-yellow-500">{formatCurrency(totalOutstanding)}</div>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <div className="text-sm text-gray-400">Aantal Debiteuren</div>
              <div className="text-2xl font-bold text-gray-100">{debtors.length}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-700 border-b border-gray-600">
              <h2 className="text-lg font-semibold text-gray-100">Debiteuren</h2>
            </div>
            <div className="overflow-auto max-h-[600px]">
              {debtors.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
                  <p>Geen openstaande facturen</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {debtors.map((debtor) => (
                    <button
                      key={debtor.id}
                      onClick={() => loadDebtorInvoices(debtor.id, debtor)}
                      className={`w-full p-4 text-left hover:bg-gray-700/50 transition-colors ${
                        selectedDebtor?.id === debtor.id ? 'bg-gray-700' : ''
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

          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-700 border-b border-gray-600">
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
                <div className="divide-y divide-gray-700">
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
      </div>
    </div>
  );
}
