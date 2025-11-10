import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Eye, Trash2, Download, Edit } from 'lucide-react';
import { CreditNotePreview } from './CreditNotePreview';
import { generateCreditNotePDF } from '../utils/pdfGenerator';

type CreditNote = {
  id: string;
  credit_note_number: string;
  credit_date: string;
  reason: string;
  subtotal: number;
  vat_amount: number;
  vat_rate: number;
  total_amount: number;
  status: string;
  notes?: string;
  tenant_id?: string;
  external_customer_id?: string;
  tenants?: { name: string; company_name: string; email: string; billing_address?: string; street?: string; postal_code?: string; city?: string };
  external_customers?: { company_name: string; contact_name: string; email?: string; street: string; postal_code: string; city: string; country: string };
  credit_note_line_items?: LineItem[];
};

type LineItem = {
  id?: string;
  credit_note_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

type CompanySettings = {
  name: string;
  company_name: string;
  address: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  kvk_number: string;
  btw_number: string;
  bank_account: string;
  root_folder_path?: string;
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
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerType, setCustomerType] = useState<'tenant' | 'external'>('tenant');
  const [previewCreditNote, setPreviewCreditNote] = useState<CreditNote | null>(null);

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
      const [creditNotesRes, invoicesRes, tenantsRes, externalCustomersRes, settingsRes] = await Promise.all([
        supabase
          .from('credit_notes')
          .select(`
            *,
            tenants (name, company_name, email, billing_address, street, postal_code, city),
            external_customers (company_name, contact_name, email, street, postal_code, city, country),
            credit_note_line_items (*)
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
        supabase.from('company_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (creditNotesRes.error) throw creditNotesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      if (externalCustomersRes.error) throw externalCustomersRes.error;

      setCreditNotes(creditNotesRes.data || []);
      setInvoices(invoicesRes.data || []);
      setTenants(tenantsRes.data || []);
      setExternalCustomers(externalCustomersRes.data || []);
      setCompanySettings(settingsRes.data || null);
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

  const handlePreview = (creditNote: CreditNote) => {
    setPreviewCreditNote(creditNote);
  };

  const handleDownloadPDF = async (creditNote: CreditNote) => {
    if (!creditNote.credit_note_line_items || creditNote.credit_note_line_items.length === 0) {
      alert('Kan geen PDF genereren: geen regelitems gevonden');
      return;
    }

    const customerName = creditNote.tenant_id
      ? creditNote.tenants?.company_name || 'Onbekend'
      : creditNote.external_customers?.company_name || 'Onbekend';

    const customerAddress = creditNote.tenant_id
      ? (creditNote.tenants?.billing_address || `${creditNote.tenants?.street || ''}\n${creditNote.tenants?.postal_code || ''} ${creditNote.tenants?.city || ''}`)
      : `${creditNote.external_customers?.street}\n${creditNote.external_customers?.postal_code} ${creditNote.external_customers?.city}`;

    const pdfData = {
      credit_note_number: creditNote.credit_note_number,
      credit_date: creditNote.credit_date,
      reason: creditNote.reason,
      customer_name: customerName,
      customer_address: customerAddress,
      line_items: creditNote.credit_note_line_items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      })),
      subtotal: creditNote.subtotal,
      vat_amount: creditNote.vat_amount,
      vat_rate: creditNote.vat_rate,
      total_amount: creditNote.total_amount,
      notes: creditNote.notes,
      company: companySettings ? {
        name: companySettings.name,
        address: companySettings.address,
        postal_code: companySettings.postal_code,
        city: companySettings.city,
        kvk: companySettings.kvk_number,
        btw: companySettings.btw_number,
        iban: companySettings.bank_account,
        email: companySettings.email,
        phone: companySettings.phone,
      } : undefined,
    };

    try {
      await generateCreditNotePDF(pdfData, companySettings?.root_folder_path);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Fout bij genereren PDF');
    }
  };

  const handleChangeStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('credit_notes')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Fout bij wijzigen status');
    }
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100">Credit Nota's</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
          >
            <Plus size={20} />
            Nieuwe Credit Nota
          </button>
        </div>
      </div>

      <div className="bg-dark-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-dark-800 border-b border-dark-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nummer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Datum</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Klant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Reden</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Bedrag</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {creditNotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                  Geen credit nota's gevonden
                </td>
              </tr>
            ) : (
              creditNotes.map((note) => (
                <tr key={note.id} className="hover:bg-dark-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-100 font-medium">{note.credit_note_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{formatDate(note.credit_date)}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {note.tenant_id
                      ? note.tenants?.company_name
                      : note.external_customers?.company_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{note.reason}</td>
                  <td className="px-6 py-4 text-sm text-gray-100 text-right font-semibold">
                    {formatCurrency(note.total_amount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded text-xs font-medium uppercase ${getStatusColor(note.status)}`}>
                      {getStatusText(note.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handlePreview(note)}
                        className="p-1.5 hover:bg-dark-700 rounded transition-colors"
                        title="Preview"
                      >
                        <Eye size={16} className="text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(note)}
                        className="p-1.5 hover:bg-dark-700 rounded transition-colors"
                        title="Download PDF"
                      >
                        <Download size={16} className="text-green-400" />
                      </button>
                      <div className="relative group">
                        <button
                          className="p-1.5 hover:bg-dark-700 rounded transition-colors"
                          title="Status wijzigen"
                        >
                          <Edit size={16} className="text-yellow-400" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[140px]">
                          <button
                            onClick={() => handleChangeStatus(note.id, 'draft')}
                            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-700 first:rounded-t-lg"
                          >
                            Concept
                          </button>
                          <button
                            onClick={() => handleChangeStatus(note.id, 'issued')}
                            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-700"
                          >
                            Uitgegeven
                          </button>
                          <button
                            onClick={() => handleChangeStatus(note.id, 'applied')}
                            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-700 last:rounded-b-lg"
                          >
                            Toegepast
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1.5 hover:bg-dark-700 rounded transition-colors"
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

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-4xl my-8 mx-4">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Nieuwe Credit Nota</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Klant Type</label>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value as 'tenant' | 'external')}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  >
                    <option value="tenant">Huurder</option>
                    <option value="external">Externe Klant</option>
                  </select>
                </div>

                {customerType === 'tenant' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">Huurder *</label>
                    <select
                      value={formData.tenant_id}
                      onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
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
                    <label className="block text-sm font-medium text-gray-200 mb-1">Externe Klant *</label>
                    <select
                      value={formData.external_customer_id}
                      onChange={(e) => setFormData({ ...formData, external_customer_id: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
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
                  <label className="block text-sm font-medium text-gray-200 mb-1">Originele Factuur (optioneel)</label>
                  <select
                    value={formData.original_invoice_id}
                    onChange={(e) => setFormData({ ...formData, original_invoice_id: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
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
                  <label className="block text-sm font-medium text-gray-200 mb-1">Credit Datum *</label>
                  <input
                    type="date"
                    value={formData.credit_date}
                    onChange={(e) => setFormData({ ...formData, credit_date: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Reden *</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  placeholder="Bijv: Correctie factuur, Retour goederen, etc."
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-200">Regelitems</label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="text-sm text-gold-500 hover:text-gold-400"
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
                        className="col-span-5 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                        required
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="Aantal"
                        className="col-span-2 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                        step="0.01"
                        required
                      />
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        placeholder="Prijs"
                        className="col-span-2 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                        step="0.01"
                        required
                      />
                      <div className="col-span-2 px-3 py-2 bg-dark-800 text-gray-100 rounded text-sm text-right">
                        {formatCurrency(item.amount)}
                      </div>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="col-span-1 p-2 hover:bg-dark-700 rounded"
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
                  <label className="block text-sm font-medium text-gray-200 mb-1">BTW % *</label>
                  <input
                    type="number"
                    value={formData.vat_rate}
                    onChange={(e) => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">Notities</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
              </div>

              <div className="bg-dark-800 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Subtotaal:</span>
                  <span className="text-gray-100 font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">BTW ({formData.vat_rate}%):</span>
                  <span className="text-gray-100 font-semibold">{formatCurrency(vatAmount)}</span>
                </div>
                <div className="flex justify-between text-lg border-t border-dark-600 pt-2">
                  <span className="text-gray-100 font-bold">Totaal:</span>
                  <span className="text-yellow-500 font-bold">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-dark-700 text-gray-200 rounded-lg hover:bg-dark-600 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Credit Nota Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewCreditNote && (
        <CreditNotePreview
          creditNote={previewCreditNote}
          companySettings={companySettings}
          onClose={() => setPreviewCreditNote(null)}
        />
      )}
    </div>
  );
}
