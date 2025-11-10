import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Eye, Trash2, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';

type CreditNote = {
  id: string;
  credit_note_number: string;
  credit_date: string;
  reason: string;
  total_amount: number;
  status: string;
  tenant_id?: string;
  external_customer_id?: string;
  tenants?: { name: string; company_name: string };
  external_customers?: { company_name: string; contact_name: string };
};

type LineItem = {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

type Invoice = {
  id: string;
  invoice_number: string;
  tenant_id?: string;
  external_customer_id?: string;
  tenants?: { name: string; company_name: string };
  external_customers?: { company_name: string; contact_name: string };
};

type Tenant = {
  id: string;
  name: string;
  company_name: string;
};

type ExternalCustomer = {
  id: string;
  company_name: string;
  contact_name: string;
};

export function CreditNotes() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<ExternalCustomer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerType, setCustomerType] = useState<'tenant' | 'external'>('tenant');

  const [formData, setFormData] = useState({
    original_invoice_id: '',
    tenant_id: '',
    external_customer_id: '',
    credit_date: new Date().toISOString().split('T')[0],
    reason: '',
    vat_rate: 21,
    notes: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, amount: 0 },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [creditNotesRes, invoicesRes, tenantsRes, externalCustomersRes] = await Promise.all([
        supabase
          .from('credit_notes')
          .select(`
            *,
            tenants (name, company_name),
            external_customers (company_name, contact_name)
          `)
          .order('credit_date', { ascending: false }),
        supabase
          .from('invoices')
          .select(`
            id,
            invoice_number,
            tenant_id,
            external_customer_id,
            tenants (name, company_name),
            external_customers (company_name, contact_name)
          `)
          .in('status', ['sent', 'paid', 'overdue']),
        supabase.from('tenants').select('id, name, company_name').order('company_name'),
        supabase.from('external_customers').select('id, company_name, contact_name').order('company_name'),
      ]);

      if (creditNotesRes.error) throw creditNotesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      if (externalCustomersRes.error) throw externalCustomersRes.error;

      setCreditNotes(creditNotesRes.data || []);
      setInvoices(invoicesRes.data || []);
      setTenants(tenantsRes.data || []);
      setExternalCustomers(externalCustomersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const newLineItems = [...lineItems];
    newLineItems[index] = {
      ...newLineItems[index],
      [field]: value,
    };

    if (field === 'quantity' || field === 'unit_price') {
      const quantity = typeof newLineItems[index].quantity === 'string'
        ? parseFloat(newLineItems[index].quantity as string) || 0
        : newLineItems[index].quantity;
      const unitPrice = typeof newLineItems[index].unit_price === 'string'
        ? parseFloat(newLineItems[index].unit_price as string) || 0
        : newLineItems[index].unit_price;
      newLineItems[index].amount = quantity * unitPrice;
    }

    setLineItems(newLineItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const vatAmount = (subtotal * formData.vat_rate) / 100;
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (customerType === 'tenant' && !formData.tenant_id) {
      alert('Selecteer een huurder');
      return;
    }
    if (customerType === 'external' && !formData.external_customer_id) {
      alert('Selecteer een externe klant');
      return;
    }

    try {
      const { data: creditNoteNumber } = await supabase.rpc('generate_credit_note_number');

      const { subtotal, vatAmount, total } = calculateTotals();

      const { data: creditNote, error: creditNoteError } = await supabase
        .from('credit_notes')
        .insert({
          credit_note_number: creditNoteNumber,
          original_invoice_id: formData.original_invoice_id || null,
          tenant_id: customerType === 'tenant' ? formData.tenant_id : null,
          external_customer_id: customerType === 'external' ? formData.external_customer_id : null,
          credit_date: formData.credit_date,
          reason: formData.reason,
          subtotal,
          vat_amount: vatAmount,
          vat_rate: formData.vat_rate,
          total_amount: total,
          status: 'issued',
          notes: formData.notes,
        })
        .select()
        .single();

      if (creditNoteError) throw creditNoteError;

      const lineItemsToInsert = lineItems.map((item) => ({
        credit_note_id: creditNote.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      }));

      const { error: lineItemsError } = await supabase
        .from('credit_note_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      alert('Credit nota succesvol aangemaakt!');
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating credit note:', error);
      alert('Fout bij aanmaken credit nota');
    }
  };

  const resetForm = () => {
    setFormData({
      original_invoice_id: '',
      tenant_id: '',
      external_customer_id: '',
      credit_date: new Date().toISOString().split('T')[0],
      reason: '',
      vat_rate: 21,
      notes: '',
    });
    setLineItems([{ description: '', quantity: 1, unit_price: 0, amount: 0 }]);
    setCustomerType('tenant');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze credit nota wilt verwijderen?')) return;

    try {
      const { error } = await supabase.from('credit_notes').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting credit note:', error);
      alert('Fout bij verwijderen credit nota');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-600 text-gray-200';
      case 'issued': return 'bg-blue-600 text-blue-100';
      case 'applied': return 'bg-green-600 text-green-100';
      default: return 'bg-gray-600 text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Concept';
      case 'issued': return 'Uitgegeven';
      case 'applied': return 'Toegepast';
      default: return status;
    }
  };

  const { subtotal, vatAmount, total } = calculateTotals();

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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-100">Credit Nota's</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            <Plus size={20} />
            Nieuwe Credit Nota
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Nummer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Datum</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Klant</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Reden</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-200">Bedrag</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-200">Status</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-200">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {creditNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Geen credit nota's gevonden
                  </td>
                </tr>
              ) : (
                creditNotes.map((note) => (
                  <tr key={note.id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-300">{note.credit_note_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{formatDate(note.credit_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {note.tenant_id
                        ? note.tenants?.company_name
                        : note.external_customers?.company_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{note.reason}</td>
                    <td className="px-4 py-3 text-sm text-gray-300 text-right font-semibold">
                      {formatCurrency(note.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(note.status)}`}>
                        {getStatusText(note.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="p-1 hover:bg-gray-600 rounded"
                          title="Verwijderen"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-700 px-6 py-4 border-b border-gray-600 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-100">Nieuwe Credit Nota</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-200">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Klant Type</label>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value as 'tenant' | 'external')}
                    className="w-full px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600"
                  >
                    <option value="tenant">Huurder</option>
                    <option value="external">Externe Klant</option>
                  </select>
                </div>

                {customerType === 'tenant' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Huurder *</label>
                    <select
                      value={formData.tenant_id}
                      onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600"
                      required
                    >
                      <option value="">Selecteer huurder</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.company_name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Externe Klant *</label>
                    <select
                      value={formData.external_customer_id}
                      onChange={(e) => setFormData({ ...formData, external_customer_id: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600"
                      required
                    >
                      <option value="">Selecteer externe klant</option>
                      {externalCustomers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.company_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Originele Factuur (optioneel)</label>
                  <select
                    value={formData.original_invoice_id}
                    onChange={(e) => setFormData({ ...formData, original_invoice_id: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600"
                  >
                    <option value="">Geen</option>
                    {invoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - {invoice.tenant_id ? invoice.tenants?.company_name : invoice.external_customers?.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Credit Datum *</label>
                  <input
                    type="date"
                    value={formData.credit_date}
                    onChange={(e) => setFormData({ ...formData, credit_date: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Reden *</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600"
                  placeholder="Bijv: Correctie factuur, Retour goederen, etc."
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-300">Regelitems</label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="text-sm text-yellow-500 hover:text-yellow-400"
                  >
                    + Toevoegen
                  </button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                        placeholder="Omschrijving"
                        className="col-span-5 px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600 text-sm"
                        required
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="Aantal"
                        className="col-span-2 px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600 text-sm"
                        step="0.01"
                        required
                      />
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        placeholder="Prijs"
                        className="col-span-2 px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600 text-sm"
                        step="0.01"
                        required
                      />
                      <div className="col-span-2 px-3 py-2 bg-gray-900 text-gray-200 rounded text-sm text-right">
                        {formatCurrency(item.amount)}
                      </div>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="col-span-1 p-2 hover:bg-gray-700 rounded"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">BTW % *</label>
                  <input
                    type="number"
                    value={formData.vat_rate}
                    onChange={(e) => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Notities</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 text-gray-200 rounded border border-gray-600"
                  />
                </div>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Subtotaal:</span>
                  <span className="text-gray-100 font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">BTW ({formData.vat_rate}%):</span>
                  <span className="text-gray-100 font-semibold">{formatCurrency(vatAmount)}</span>
                </div>
                <div className="flex justify-between text-lg border-t border-gray-600 pt-2">
                  <span className="text-gray-100 font-bold">Totaal:</span>
                  <span className="text-yellow-500 font-bold">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Credit Nota Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
