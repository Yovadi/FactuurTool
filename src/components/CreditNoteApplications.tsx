import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Link, DollarSign, Send, CheckCircle } from 'lucide-react';

type CreditNote = {
  id: string;
  credit_note_number: string;
  total_amount: number;
  tenant_id?: string;
  external_customer_id?: string;
  tenants?: { company_name: string };
  external_customers?: { company_name: string };
};

type Invoice = {
  id: string;
  invoice_number: string;
  amount: number;
  applied_credit: number;
  status: string;
};

type Application = {
  id: string;
  credit_note_id: string;
  invoice_id?: string;
  applied_amount: number;
  application_date: string;
  application_type: string;
  notes?: string;
  invoices?: Invoice;
};

type CreditNoteApplicationsProps = {
  creditNote: CreditNote;
  onClose: () => void;
  onApplied: () => void;
};

export function CreditNoteApplications({ creditNote, onClose, onApplied }: CreditNoteApplicationsProps) {
  const [availableCredit, setAvailableCredit] = useState(0);
  const [applications, setApplications] = useState<Application[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const [linkFormData, setLinkFormData] = useState({
    invoice_id: '',
    amount: 0,
  });

  const [refundFormData, setRefundFormData] = useState({
    amount: 0,
    notes: '',
  });

  const [manualFormData, setManualFormData] = useState({
    amount: 0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [creditNote.id]);

  const loadData = async () => {
    setLoading(true);

    const { data: availableData } = await supabase
      .rpc('get_available_credit', { credit_note_id_param: creditNote.id });

    setAvailableCredit(availableData || 0);

    const { data: appsData } = await supabase
      .from('credit_note_applications')
      .select(`
        *,
        invoices (
          id,
          invoice_number,
          amount,
          applied_credit,
          status
        )
      `)
      .eq('credit_note_id', creditNote.id)
      .order('application_date', { ascending: false });

    setApplications(appsData || []);

    const customerId = creditNote.tenant_id || creditNote.external_customer_id;
    const customerField = creditNote.tenant_id ? 'tenant_id' : 'external_customer_id';

    if (customerId) {
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*')
        .eq(customerField, customerId)
        .neq('status', 'paid')
        .order('invoice_date', { ascending: false });

      setCustomerInvoices(invoicesData || []);
    }

    setLoading(false);
  };

  const handleLinkToInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!linkFormData.invoice_id || linkFormData.amount <= 0) {
      alert('Vul alle velden in');
      return;
    }

    if (linkFormData.amount > availableCredit) {
      alert('Bedrag kan niet hoger zijn dan het beschikbare credit');
      return;
    }

    const { error } = await supabase
      .from('credit_note_applications')
      .insert({
        credit_note_id: creditNote.id,
        invoice_id: linkFormData.invoice_id,
        applied_amount: linkFormData.amount,
        application_type: 'invoice_credit',
      });

    if (error) {
      console.error('Error applying credit:', error);
      alert('Fout bij toepassen credit');
      return;
    }

    await loadData();
    setShowLinkForm(false);
    setLinkFormData({ invoice_id: '', amount: 0 });
    onApplied();
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();

    if (refundFormData.amount <= 0) {
      alert('Vul een geldig bedrag in');
      return;
    }

    if (refundFormData.amount > availableCredit) {
      alert('Bedrag kan niet hoger zijn dan het beschikbare credit');
      return;
    }

    const { error } = await supabase
      .from('credit_note_applications')
      .insert({
        credit_note_id: creditNote.id,
        applied_amount: refundFormData.amount,
        application_type: 'refund',
        notes: refundFormData.notes || 'Terugbetaling aan klant',
      });

    if (error) {
      console.error('Error recording refund:', error);
      alert('Fout bij registreren terugbetaling');
      return;
    }

    await loadData();
    setShowRefundForm(false);
    setRefundFormData({ amount: 0, notes: '' });
    onApplied();
  };

  const handleManualApplication = async (e: React.FormEvent) => {
    e.preventDefault();

    if (manualFormData.amount <= 0) {
      alert('Vul een geldig bedrag in');
      return;
    }

    if (manualFormData.amount > availableCredit) {
      alert('Bedrag kan niet hoger zijn dan het beschikbare credit');
      return;
    }

    const { error } = await supabase
      .from('credit_note_applications')
      .insert({
        credit_note_id: creditNote.id,
        applied_amount: manualFormData.amount,
        application_type: 'manual',
        notes: manualFormData.notes || 'Handmatig toegepast',
      });

    if (error) {
      console.error('Error recording manual application:', error);
      alert('Fout bij registreren handmatige toepassing');
      return;
    }

    await loadData();
    setShowManualForm(false);
    setManualFormData({ amount: 0, notes: '' });
    onApplied();
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Weet je zeker dat je deze toepassing wilt verwijderen?')) {
      return;
    }

    const { error } = await supabase
      .from('credit_note_applications')
      .delete()
      .eq('id', applicationId);

    if (error) {
      console.error('Error deleting application:', error);
      alert('Fout bij verwijderen toepassing');
      return;
    }

    await loadData();
    onApplied();
  };

  const getApplicationTypeLabel = (type: string) => {
    switch (type) {
      case 'invoice_credit':
        return 'Gekoppeld aan factuur';
      case 'refund':
        return 'Terugbetaling';
      case 'manual':
        return 'Handmatig toegepast';
      default:
        return type;
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

  const customerName = creditNote.tenants?.company_name || creditNote.external_customers?.company_name || 'Onbekend';

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-dark-900 rounded-lg p-6">
          <p className="text-gray-100">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-dark-900 rounded-lg max-w-4xl w-full my-8">
        <div className="sticky top-0 bg-dark-800 border-b border-dark-700 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <div>
            <h3 className="text-xl font-bold text-gray-100">Credit Nota Toepassen</h3>
            <p className="text-sm text-gray-400 mt-1">
              {creditNote.credit_note_number} - {customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-300" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-400">Totaal Credit Bedrag</p>
                <p className="text-2xl font-bold text-gray-100">{formatCurrency(creditNote.total_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Beschikbaar Credit</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(availableCredit)}</p>
              </div>
            </div>
          </div>

          {availableCredit > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setShowLinkForm(true)}
                className="flex flex-col items-center gap-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg p-4 transition-colors"
              >
                <Link size={32} className="text-blue-400" />
                <span className="text-sm font-medium text-gray-100">Koppel aan Factuur</span>
                <span className="text-xs text-gray-400">Verreken met openstaande factuur</span>
              </button>

              <button
                onClick={() => setShowRefundForm(true)}
                className="flex flex-col items-center gap-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg p-4 transition-colors"
              >
                <DollarSign size={32} className="text-green-400" />
                <span className="text-sm font-medium text-gray-100">Terugbetaling</span>
                <span className="text-xs text-gray-400">Registreer terugbetaling</span>
              </button>

              <button
                onClick={() => setShowManualForm(true)}
                className="flex flex-col items-center gap-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg p-4 transition-colors"
              >
                <CheckCircle size={32} className="text-yellow-400" />
                <span className="text-sm font-medium text-gray-100">Handmatig</span>
                <span className="text-xs text-gray-400">Markeer als toegepast</span>
              </button>
            </div>
          )}

          <div>
            <h4 className="text-lg font-semibold text-gray-100 mb-3">Toepassingen</h4>
            {applications.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Nog geen toepassingen</p>
            ) : (
              <div className="space-y-2">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="bg-dark-800 rounded-lg p-4 border border-dark-700 flex justify-between items-center"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-100">{getApplicationTypeLabel(app.application_type)}</p>
                      {app.invoices && (
                        <p className="text-xs text-gray-400 mt-1">Factuur: {app.invoices.invoice_number}</p>
                      )}
                      {app.notes && (
                        <p className="text-xs text-gray-400 mt-1">{app.notes}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{formatDate(app.application_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold text-red-400">-{formatCurrency(app.applied_amount)}</p>
                      <button
                        onClick={() => handleDeleteApplication(app.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Verwijderen"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showLinkForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Koppel aan Factuur</h3>
            <form onSubmit={handleLinkToInvoice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Selecteer Factuur
                </label>
                <select
                  value={linkFormData.invoice_id}
                  onChange={(e) => {
                    const invoice = customerInvoices.find(inv => inv.id === e.target.value);
                    setLinkFormData({
                      invoice_id: e.target.value,
                      amount: invoice ? Math.min(availableCredit, invoice.amount - (invoice.applied_credit || 0)) : 0,
                    });
                  }}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecteer een factuur</option>
                  {customerInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} - {formatCurrency(invoice.amount - (invoice.applied_credit || 0))} openstaand
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Bedrag
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={availableCredit}
                  value={linkFormData.amount || ''}
                  onChange={(e) => setLinkFormData({ ...linkFormData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Max: {formatCurrency(availableCredit)}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Toepassen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkForm(false);
                    setLinkFormData({ invoice_id: '', amount: 0 });
                  }}
                  className="flex-1 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRefundForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Terugbetaling Registreren</h3>
            <form onSubmit={handleRefund} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Bedrag
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={availableCredit}
                  value={refundFormData.amount || ''}
                  onChange={(e) => setRefundFormData({ ...refundFormData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Max: {formatCurrency(availableCredit)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Notities (optioneel)
                </label>
                <textarea
                  value={refundFormData.notes}
                  onChange={(e) => setRefundFormData({ ...refundFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Bijv. overgemaakt op 10-11-2025"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Registreren
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRefundForm(false);
                    setRefundFormData({ amount: 0, notes: '' });
                  }}
                  className="flex-1 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showManualForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Handmatig Toepassen</h3>
            <form onSubmit={handleManualApplication} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Bedrag
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={availableCredit}
                  value={manualFormData.amount || ''}
                  onChange={(e) => setManualFormData({ ...manualFormData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Max: {formatCurrency(availableCredit)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Notities
                </label>
                <textarea
                  value={manualFormData.notes}
                  onChange={(e) => setManualFormData({ ...manualFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  rows={3}
                  placeholder="Reden voor handmatige toepassing"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Toepassen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowManualForm(false);
                    setManualFormData({ amount: 0, notes: '' });
                  }}
                  className="flex-1 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
