import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, User, FileText, AlertCircle } from 'lucide-react';

type CustomerCredit = {
  customer_id: string;
  customer_name: string;
  customer_type: 'tenant' | 'external';
  total_credit: number;
  available_credit: number;
  unapplied_credit_notes: number;
  outstanding_invoices: number;
  outstanding_amount: number;
};

type UnappliedCreditNote = {
  id: string;
  credit_note_number: string;
  credit_date: string;
  total_amount: number;
  available_credit: number;
  tenant_id?: string;
  external_customer_id?: string;
  tenants?: { company_name: string };
  external_customers?: { company_name: string };
  status: string;
};

export function CreditOverview() {
  const [customerCredits, setCustomerCredits] = useState<CustomerCredit[]>([]);
  const [unappliedCreditNotes, setUnappliedCreditNotes] = useState<UnappliedCreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'customers' | 'unapplied'>('customers');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: creditNotes } = await supabase
      .from('credit_notes')
      .select(`
        id,
        credit_note_number,
        credit_date,
        total_amount,
        tenant_id,
        external_customer_id,
        status,
        tenants (company_name),
        external_customers (company_name)
      `)
      .order('credit_date', { ascending: false });

    if (creditNotes) {
      const notesWithAvailable = await Promise.all(
        creditNotes.map(async (note) => {
          const { data: available } = await supabase
            .rpc('get_available_credit', { credit_note_id_param: note.id });
          return {
            ...note,
            available_credit: available || 0,
          };
        })
      );

      const unapplied = notesWithAvailable.filter(note => note.available_credit > 0);
      setUnappliedCreditNotes(unapplied);

      const customerMap = new Map<string, CustomerCredit>();

      for (const note of notesWithAvailable) {
        const customerId = note.tenant_id || note.external_customer_id || '';
        const customerName = note.tenants?.company_name || note.external_customers?.company_name || 'Onbekend';
        const customerType = note.tenant_id ? 'tenant' : 'external';

        if (!customerMap.has(customerId)) {
          const { data: invoices } = await supabase
            .from('invoices')
            .select('amount, applied_credit, status')
            .eq(customerType === 'tenant' ? 'tenant_id' : 'external_customer_id', customerId)
            .neq('status', 'paid');

          const outstandingInvoices = invoices || [];
          const outstandingAmount = outstandingInvoices.reduce(
            (sum, inv) => sum + (inv.amount - (inv.applied_credit || 0)),
            0
          );

          customerMap.set(customerId, {
            customer_id: customerId,
            customer_name: customerName,
            customer_type: customerType,
            total_credit: 0,
            available_credit: 0,
            unapplied_credit_notes: 0,
            outstanding_invoices: outstandingInvoices.length,
            outstanding_amount: outstandingAmount,
          });
        }

        const customer = customerMap.get(customerId)!;
        customer.total_credit += note.total_amount;
        customer.available_credit += note.available_credit;
        if (note.available_credit > 0) {
          customer.unapplied_credit_notes++;
        }
      }

      const customersWithCredit = Array.from(customerMap.values()).filter(
        c => c.available_credit > 0
      );
      setCustomerCredits(customersWithCredit);
    }

    setLoading(false);
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

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Laden...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100">Credit Overzicht</h2>
      </div>

      <div className="mb-6 flex gap-2 border-b border-dark-700">
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 ${
            activeTab === 'customers'
              ? 'text-gold-500 border-gold-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <User size={18} />
          Klanten met Credit ({customerCredits.length})
        </button>
        <button
          onClick={() => setActiveTab('unapplied')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 ${
            activeTab === 'unapplied'
              ? 'text-gold-500 border-gold-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <FileText size={18} />
          Niet Toegepaste Credit Nota's ({unappliedCreditNotes.length})
        </button>
      </div>

      {activeTab === 'customers' && (
        <div className="space-y-4">
          {customerCredits.length === 0 ? (
            <div className="bg-dark-900 rounded-lg p-8 text-center">
              <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Geen klanten met openstaand credit</p>
            </div>
          ) : (
            customerCredits.map((customer) => (
              <div
                key={customer.customer_id}
                className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <User className="text-gold-500" size={24} />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-100">
                        {customer.customer_name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {customer.customer_type === 'tenant' ? 'Huurder' : 'Externe Huurder'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Beschikbaar Credit</p>
                    <p className="text-2xl font-bold text-green-400">
                      {formatCurrency(customer.available_credit)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-dark-700">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Credit Nota's</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {customer.unapplied_credit_notes}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Openstaande Facturen</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {customer.outstanding_invoices}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Openstaand Bedrag</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {formatCurrency(customer.outstanding_amount)}
                    </p>
                  </div>
                </div>

                {customer.available_credit > 0 && customer.outstanding_amount > 0 && (
                  <div className="mt-4 p-3 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-yellow-500" />
                      <p className="text-sm text-yellow-500">
                        Deze klant heeft credit beschikbaar en openstaande facturen.
                        Overweeg om het credit toe te passen.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'unapplied' && (
        <div className="space-y-4">
          {unappliedCreditNotes.length === 0 ? (
            <div className="bg-dark-900 rounded-lg p-8 text-center">
              <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Alle credit nota's zijn toegepast</p>
            </div>
          ) : (
            unappliedCreditNotes.map((note) => {
              const customerName = note.tenants?.company_name || note.external_customers?.company_name || 'Onbekend';

              return (
                <div
                  key={note.id}
                  className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <FileText className="text-red-400" size={24} />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-gray-100">
                            {customerName}
                          </h3>
                          <span className="text-sm font-medium text-red-400">
                            {note.credit_note_number.replace(/^CN-/, '')}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            note.status === 'draft' ? 'bg-gray-700 text-gray-300' :
                            note.status === 'issued' ? 'bg-blue-600 text-blue-100' :
                            'bg-green-600 text-green-100'
                          }`}>
                            {note.status === 'draft' ? 'Concept' :
                             note.status === 'issued' ? 'Uitgegeven' : 'Toegepast'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-300">
                          <span>{formatDate(note.credit_date)}</span>
                          <span>•</span>
                          <span>Totaal: {formatCurrency(note.total_amount)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Beschikbaar</p>
                      <p className="text-xl font-bold text-green-400">
                        {formatCurrency(note.available_credit)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
