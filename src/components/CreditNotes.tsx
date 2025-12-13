import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Eye, Trash2, Download, Edit, Edit2, FileText, CheckCircle } from 'lucide-react';
import { CreditNotePreview } from './CreditNotePreview';
import { CreditNoteApplications } from './CreditNoteApplications';
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

type CreditNotesProps = {
  prefilledInvoiceData?: {
    invoice: any;
    tenant: any;
    spaces: any[];
  } | null;
  onClearPrefilled?: () => void;
};

export function CreditNotes({ prefilledInvoiceData, onClearPrefilled }: CreditNotesProps = {}) {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<ExternalCustomer[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerType, setCustomerType] = useState<'tenant' | 'external'>('tenant');
  const [previewCreditNote, setPreviewCreditNote] = useState<CreditNote | null>(null);
  const [editingCreditNote, setEditingCreditNote] = useState<CreditNote | null>(null);
  const [applyingCreditNote, setApplyingCreditNote] = useState<CreditNote | null>(null);

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

  useEffect(() => {
    if (prefilledInvoiceData) {
      handlePrefilledInvoice();
    }
  }, [prefilledInvoiceData]);

  const handlePrefilledInvoice = () => {
    if (!prefilledInvoiceData) return;

    const { invoice, tenant, spaces } = prefilledInvoiceData;

    const isExternal = !!invoice.external_customer_id;
    setCustomerType(isExternal ? 'external' : 'tenant');

    setFormData({
      original_invoice_id: invoice.id || '',
      tenant_id: invoice.tenant_id || '',
      external_customer_id: invoice.external_customer_id || '',
      credit_date: new Date().toISOString().split('T')[0],
      reason: `Correctie factuur ${invoice.invoice_number}`,
      vat_rate: invoice.vat_rate || 21,
      notes: '',
    });

    const convertedLineItems = spaces.map(space => ({
      description: space.space_name,
      quantity: space.square_footage || 1,
      unit_price: space.price_per_sqm || space.monthly_rent,
      amount: space.monthly_rent,
    }));

    setLineItems(convertedLineItems.length > 0 ? convertedLineItems : [
      { description: '', quantity: 1, unit_price: 0, amount: 0 }
    ]);

    setShowForm(true);

    if (onClearPrefilled) {
      onClearPrefilled();
    }
  };

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
      return;
    }
    if (customerType === 'external' && !formData.external_customer_id) {
      return;
    }

    try {
      const { subtotal, vatAmount, total } = calculateTotals();

      if (editingCreditNote) {
        const { error: creditNoteError } = await supabase
          .from('credit_notes')
          .update({
            tenant_id: customerType === 'tenant' ? formData.tenant_id : null,
            external_customer_id: customerType === 'external' ? formData.external_customer_id : null,
            credit_date: formData.credit_date,
            reason: formData.reason,
            subtotal,
            vat_amount: vatAmount,
            vat_rate: formData.vat_rate,
            total_amount: total,
            notes: formData.notes,
          })
          .eq('id', editingCreditNote.id);

        if (creditNoteError) throw creditNoteError;

        const { error: deleteError } = await supabase
          .from('credit_note_line_items')
          .delete()
          .eq('credit_note_id', editingCreditNote.id);

        if (deleteError) throw deleteError;

        const lineItemsToInsert = lineItems.map((item) => ({
          credit_note_id: editingCreditNote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
        }));

        const { error: lineItemsError } = await supabase
          .from('credit_note_line_items')
          .insert(lineItemsToInsert);

        if (lineItemsError) throw lineItemsError;
      } else {
        const { data: creditNoteNumber } = await supabase.rpc('generate_credit_note_number');

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
      }

      setShowForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving credit note:', error);
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
    setEditingCreditNote(null);
  };

  const handleEdit = (creditNote: CreditNote) => {
    setEditingCreditNote(creditNote);
    setFormData({
      original_invoice_id: '',
      tenant_id: creditNote.tenant_id || '',
      external_customer_id: creditNote.external_customer_id || '',
      credit_date: creditNote.credit_date,
      reason: creditNote.reason,
      vat_rate: creditNote.vat_rate,
      notes: creditNote.notes || '',
    });
    setLineItems(creditNote.credit_note_line_items || [{ description: '', quantity: 1, unit_price: 0, amount: 0 }]);
    setCustomerType(creditNote.tenant_id ? 'tenant' : 'external');
    setShowForm(true);
  };

  const handlePreview = (creditNote: CreditNote) => {
    setPreviewCreditNote(creditNote);
  };

  const handleDownloadPDF = async (creditNote: CreditNote) => {
    if (!creditNote.credit_note_line_items || creditNote.credit_note_line_items.length === 0) {
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
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('credit_notes').delete().eq('id', id);
      if (error) throw error;
      setPreviewCreditNote(null);
      loadData();
    } catch (error) {
      console.error('Error deleting credit note:', error);
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-100">Credit Nota's</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
        >
          <Plus size={20} />
          Nieuwe Credit Nota
        </button>
      </div>

      <div className="space-y-4">
        {creditNotes.length === 0 ? (
          <div className="bg-dark-900 rounded-lg p-8 text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <p className="text-gray-400">Geen credit nota's gevonden</p>
          </div>
        ) : (
          <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[1000px]">
                <thead>
                  <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                    <th className="text-left px-4 py-3 font-semibold w-[18%]">Klant</th>
                    <th className="text-left px-4 py-3 font-semibold w-[12%]">Credit Nota Nr.</th>
                    <th className="text-left px-4 py-3 font-semibold w-[12%]">Datum</th>
                    <th className="text-left px-4 py-3 font-semibold w-[20%]">Reden</th>
                    <th className="text-right px-4 py-3 font-semibold w-[12%]">Bedrag</th>
                    <th className="text-center px-4 py-3 font-semibold w-[12%]">Status</th>
                    <th className="text-right px-4 py-3 font-semibold w-[14%]">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNotes.map((note) => {
                    const customerName = note.tenant_id
                      ? note.tenants?.company_name
                      : note.external_customers?.company_name;

                    return (
                      <tr
                        key={note.id}
                        className="border-b border-dark-800 hover:bg-dark-800 transition-colors cursor-pointer"
                        onClick={() => handlePreview(note)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="text-red-400" size={18} />
                            <span className="text-gray-100 font-medium">{customerName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-red-400 font-medium text-sm">
                          {note.credit_note_number.replace(/^CN-/, '')}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {formatDate(note.credit_date)}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          <span className="line-clamp-1 max-w-[300px]">{note.reason}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-red-400 font-bold">
                          -{formatCurrency(note.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(note.status)}`}>
                            {getStatusText(note.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreview(note);
                              }}
                              className="text-gold-500 hover:text-gold-400 transition-colors p-1.5 rounded hover:bg-dark-700"
                              title="Bekijken"
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-4xl my-8 mx-4 border border-dark-700">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {editingCreditNote ? 'Credit Nota Bewerken' : 'Nieuwe Credit Nota'}
            </h3>

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
                    <option value="external">Externe Huurder</option>
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
                    <label className="block text-sm font-medium text-gray-200 mb-1">Externe Huurder *</label>
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
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-dark-700 text-gray-200 rounded-lg hover:bg-dark-600 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  {editingCreditNote ? 'Credit Nota Bijwerken' : 'Credit Nota Aanmaken'}
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
          onDownload={() => handleDownloadPDF(previewCreditNote)}
          onEdit={() => {
            setPreviewCreditNote(null);
            handleEdit(previewCreditNote);
          }}
          onDelete={() => {
            handleDelete(previewCreditNote.id);
          }}
          onApply={() => {
            setPreviewCreditNote(null);
            setApplyingCreditNote(previewCreditNote);
          }}
          onSend={undefined}
        />
      )}

      {applyingCreditNote && (
        <CreditNoteApplications
          creditNote={applyingCreditNote}
          onClose={() => setApplyingCreditNote(null)}
          onApplied={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}
