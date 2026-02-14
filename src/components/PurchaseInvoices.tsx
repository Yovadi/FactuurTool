import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CompanySettings } from '../lib/supabase';
import { Plus, Search, Eye, Edit2, Trash2, Upload, FileText, CheckCircle, Clock, AlertCircle, Sparkles, X, Filter, Loader2, RefreshCw, Link2 } from 'lucide-react';
import { PurchaseInvoiceUpload } from './PurchaseInvoiceUpload';
import { PurchaseInvoicePreview } from './PurchaseInvoicePreview';
import { ConfirmModal } from './ConfirmModal';
import { syncPurchaseInvoiceToEBoekhouden } from '../lib/eboekhoudenSync';

type LineItem = {
  id?: string;
  purchase_invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  vat_rate: number;
  grootboek_id?: number | null;
};

type PurchaseInvoice = {
  id: string;
  invoice_number: string;
  supplier_name: string;
  supplier_address: string;
  supplier_postal_code: string;
  supplier_city: string;
  supplier_country: string;
  supplier_vat_number: string;
  supplier_kvk_number: string;
  supplier_iban: string;
  invoice_date: string;
  due_date: string | null;
  order_number: string;
  subtotal: number;
  vat_amount: number;
  vat_rate: number;
  total_amount: number;
  status: string;
  category: string;
  notes: string;
  original_file_name: string;
  ai_extracted: boolean;
  ai_confidence: number;
  eboekhouden_factuur_id: number | null;
  eboekhouden_synced_at: string | null;
  eboekhouden_relatie_id: number | null;
  created_at: string;
  purchase_invoice_line_items?: LineItem[];
};

type FormData = {
  invoice_number: string;
  order_number: string;
  supplier_name: string;
  supplier_address: string;
  supplier_postal_code: string;
  supplier_city: string;
  supplier_country: string;
  supplier_vat_number: string;
  supplier_kvk_number: string;
  supplier_iban: string;
  invoice_date: string;
  due_date: string;
  vat_rate: number;
  category: string;
  notes: string;
};

const CATEGORIES = [
  { value: '', label: 'Selecteer categorie' },
  { value: 'onderhoud', label: 'Onderhoud' },
  { value: 'kantoorbenodigdheden', label: 'Kantoorbenodigdheden' },
  { value: 'energie', label: 'Energie' },
  { value: 'water', label: 'Water' },
  { value: 'verzekering', label: 'Verzekering' },
  { value: 'telecom', label: 'Telecom / Internet' },
  { value: 'schoonmaak', label: 'Schoonmaak' },
  { value: 'beveiliging', label: 'Beveiliging' },
  { value: 'belastingen', label: 'Belastingen' },
  { value: 'advies', label: 'Advieskosten' },
  { value: 'overig', label: 'Overig' },
];

const emptyForm: FormData = {
  invoice_number: '',
  order_number: '',
  supplier_name: '',
  supplier_address: '',
  supplier_postal_code: '',
  supplier_city: '',
  supplier_country: 'Nederland',
  supplier_vat_number: '',
  supplier_kvk_number: '',
  supplier_iban: '',
  invoice_date: new Date().toISOString().split('T')[0],
  due_date: '',
  vat_rate: 21,
  category: '',
  notes: '',
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('nl-NL');

export function PurchaseInvoices() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<PurchaseInvoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, amount: 0, vat_rate: 21 },
  ]);
  const [aiExtracted, setAiExtracted] = useState(false);
  const [aiConfidence, setAiConfidence] = useState(0);
  const [originalFileName, setOriginalFileName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [grootboekMappings, setGrootboekMappings] = useState<Array<{
    id: string;
    local_category: string;
    grootboek_code: string;
    grootboek_id: number;
    grootboek_omschrijving: string;
  }>>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [aiNotification, setAiNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, settingsRes, mappingsRes] = await Promise.all([
        supabase
          .from('purchase_invoices')
          .select('*, purchase_invoice_line_items(*)')
          .order('invoice_date', { ascending: false }),
        supabase
          .from('company_settings')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('eboekhouden_grootboek_mapping')
          .select('*')
          .order('local_category'),
      ]);

      if (invoicesRes.data) setInvoices(invoicesRes.data);
      if (settingsRes.data) {
        setCompanySettings(settingsRes.data);
        if (settingsRes.data.openai_api_key) setOpenaiApiKey(settingsRes.data.openai_api_key);
      }
      if (mappingsRes.data) setGrootboekMappings(mappingsRes.data);

      const url = import.meta.env.VITE_SUPABASE_URL || 'https://qlvndvpxhqmjljjpehkn.supabase.co';
      setSupabaseUrl(url);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    setAiNotification({ type, message });
    notificationTimerRef.current = setTimeout(() => setAiNotification(null), 6000);
  };

  const validFileTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (!validFileTypes.includes(droppedFile.type)) {
      showNotification('error', 'Ongeldig bestandstype. Upload een PNG, JPG, WebP of PDF bestand.');
      return;
    }

    if (droppedFile.size > 20 * 1024 * 1024) {
      showNotification('error', 'Bestand is te groot. Maximaal 20MB.');
      return;
    }

    if (openaiApiKey) {
      handleSaveAndProcess(droppedFile, droppedFile.name);
    } else {
      handleManualEntry(droppedFile.name);
    }
  }, [openaiApiKey]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleManualEntry = (fileName: string) => {
    resetForm();
    setOriginalFileName(fileName);
    setShowUpload(false);
    setShowForm(true);
  };

  const handleSaveAndProcess = async (file: File, fileName: string) => {
    setShowUpload(false);

    try {
      const { data: invoice, error } = await supabase
        .from('purchase_invoices')
        .insert({
          invoice_number: '',
          supplier_name: fileName.replace(/\.[^/.]+$/, ''),
          original_file_name: fileName,
          status: 'draft',
          ai_extracted: false,
          ai_confidence: 0,
        })
        .select()
        .single();

      if (error) throw error;

      await loadData();

      setProcessingIds(prev => new Set(prev).add(invoice.id));

      const base64 = await fileToBase64(file);

      const response = await fetch(`${supabaseUrl}/functions/v1/parse-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_base64: base64,
          file_type: file.type,
          openai_api_key: openaiApiKey,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'AI herkenning mislukt');
      }

      const data = result.data;
      const items: LineItem[] = (data.line_items || []).map((item: any) => ({
        description: item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        amount: item.amount || 0,
        vat_rate: item.vat_rate || data.vat_rate || 21,
      }));

      const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const vatRate = data.vat_rate || 21;
      const vatAmount = Math.round((subtotal * vatRate) / 100 * 100) / 100;
      const total = subtotal + vatAmount;

      const { error: updateError } = await supabase
        .from('purchase_invoices')
        .update({
          invoice_number: data.invoice_number || '',
          order_number: data.order_number || '',
          supplier_name: data.supplier_name || fileName,
          supplier_address: data.supplier_address || '',
          supplier_postal_code: data.supplier_postal_code || '',
          supplier_city: data.supplier_city || '',
          supplier_country: data.supplier_country || 'Nederland',
          supplier_vat_number: data.supplier_vat_number || '',
          supplier_kvk_number: data.supplier_kvk_number || '',
          supplier_iban: data.supplier_iban || '',
          invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
          due_date: data.due_date || null,
          subtotal,
          vat_amount: vatAmount,
          vat_rate: vatRate,
          total_amount: total,
          category: data.category || '',
          ai_extracted: true,
          ai_confidence: 85,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          purchase_invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          vat_rate: item.vat_rate,
        }));
        await supabase.from('purchase_invoice_line_items').insert(itemsToInsert);
      }

      showNotification('success', `Factuur "${data.supplier_name || fileName}" is succesvol herkend met AI.`);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout';
      showNotification('error', `AI herkenning mislukt: ${message}. U kunt de factuur handmatig bewerken.`);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      const qty = typeof updated[index].quantity === 'string' ? parseFloat(updated[index].quantity as unknown as string) || 0 : updated[index].quantity;
      const price = typeof updated[index].unit_price === 'string' ? parseFloat(updated[index].unit_price as unknown as string) || 0 : updated[index].unit_price;
      updated[index].amount = Math.round(qty * price * 100) / 100;
    }

    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0, amount: 0, vat_rate: formData.vat_rate }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const vatAmount = Math.round((subtotal * formData.vat_rate) / 100 * 100) / 100;
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { subtotal, vatAmount, total } = calculateTotals();

    try {
      if (editingId) {
        const { error } = await supabase
          .from('purchase_invoices')
          .update({
            ...formData,
            due_date: formData.due_date || null,
            subtotal,
            vat_amount: vatAmount,
            total_amount: total,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;

        await supabase.from('purchase_invoice_line_items').delete().eq('purchase_invoice_id', editingId);

        const itemsToInsert = lineItems.map((item) => ({
          purchase_invoice_id: editingId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          vat_rate: item.vat_rate,
        }));

        const { error: itemsError } = await supabase.from('purchase_invoice_line_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      } else {
        const { data: invoice, error } = await supabase
          .from('purchase_invoices')
          .insert({
            ...formData,
            due_date: formData.due_date || null,
            subtotal,
            vat_amount: vatAmount,
            total_amount: total,
            original_file_name: originalFileName,
            ai_extracted: aiExtracted,
            ai_confidence: aiConfidence,
          })
          .select()
          .single();

        if (error) throw error;

        const itemsToInsert = lineItems.map((item) => ({
          purchase_invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          vat_rate: item.vat_rate,
        }));

        const { error: itemsError } = await supabase.from('purchase_invoice_line_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving invoice:', error);
    }
  };

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setLineItems([{ description: '', quantity: 1, unit_price: 0, amount: 0, vat_rate: 21 }]);
    setEditingId(null);
    setAiExtracted(false);
    setAiConfidence(0);
    setOriginalFileName('');
    setShowForm(false);
  };

  const startEdit = (invoice: PurchaseInvoice) => {
    setEditingId(invoice.id);
    setFormData({
      invoice_number: invoice.invoice_number,
      order_number: invoice.order_number || '',
      supplier_name: invoice.supplier_name,
      supplier_address: invoice.supplier_address,
      supplier_postal_code: invoice.supplier_postal_code,
      supplier_city: invoice.supplier_city,
      supplier_country: invoice.supplier_country,
      supplier_vat_number: invoice.supplier_vat_number,
      supplier_kvk_number: invoice.supplier_kvk_number,
      supplier_iban: invoice.supplier_iban,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || '',
      vat_rate: invoice.vat_rate,
      category: invoice.category,
      notes: invoice.notes,
    });
    setLineItems(
      invoice.purchase_invoice_line_items?.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        vat_rate: item.vat_rate || 21,
      })) || [{ description: '', quantity: 1, unit_price: 0, amount: 0, vat_rate: 21 }]
    );
    setAiExtracted(invoice.ai_extracted);
    setOriginalFileName(invoice.original_file_name);
    setPreviewInvoice(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('purchase_invoices').delete().eq('id', id);
      if (error) throw error;
      setPreviewInvoice(null);
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const updateCategory = async (id: string, category: string) => {
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .update({ category, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, category } : inv));
    } catch (error) {
      console.error('Error updating category:', error);
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setPreviewInvoice(null);
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const ebConnected = companySettings?.eboekhouden_connected && !!companySettings?.eboekhouden_api_token;

  const handleSyncToEBoekhouden = async (invoice: PurchaseInvoice) => {
    if (!companySettings?.eboekhouden_api_token || !companySettings) return;
    if (invoice.eboekhouden_factuur_id) {
      showNotification('success', 'Deze factuur is al gesynchroniseerd met e-Boekhouden.');
      return;
    }

    setSyncingIds(prev => new Set(prev).add(invoice.id));
    try {
      const result = await syncPurchaseInvoiceToEBoekhouden(
        companySettings.eboekhouden_api_token,
        invoice as any,
        companySettings
      );
      if (result.success) {
        showNotification('success', `Inkoopfactuur "${invoice.supplier_name}" gesynchroniseerd met e-Boekhouden.`);
        await loadData();
      } else {
        showNotification('error', result.error || 'Synchronisatie mislukt.');
      }
    } catch (err) {
      showNotification('error', 'Fout bij synchroniseren met e-Boekhouden.');
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(invoice.id);
        return next;
      });
    }
  };

  const handleSyncAll = async () => {
    if (!companySettings?.eboekhouden_api_token || !companySettings) return;
    const unsyncedInvoices = invoices.filter(inv => !inv.eboekhouden_factuur_id);
    if (unsyncedInvoices.length === 0) {
      showNotification('success', 'Alle inkoopfacturen zijn al gesynchroniseerd.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    for (const invoice of unsyncedInvoices) {
      setSyncingIds(prev => new Set(prev).add(invoice.id));
      try {
        const result = await syncPurchaseInvoiceToEBoekhouden(
          companySettings.eboekhouden_api_token!,
          invoice as any,
          companySettings
        );
        if (result.success) successCount++;
        else errorCount++;
      } catch {
        errorCount++;
      } finally {
        setSyncingIds(prev => {
          const next = new Set(prev);
          next.delete(invoice.id);
          return next;
        });
      }
    }

    await loadData();
    if (errorCount === 0) {
      showNotification('success', `${successCount} inkoopfacturen gesynchroniseerd met e-Boekhouden.`);
    } else {
      showNotification('error', `${successCount} geslaagd, ${errorCount} mislukt.`);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      !searchQuery ||
      inv.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return { bg: 'bg-green-600', text: 'text-green-100', label: 'Betaald' };
      case 'pending': return { bg: 'bg-yellow-600', text: 'text-yellow-100', label: 'In Afwachting' };
      case 'overdue': return { bg: 'bg-red-600', text: 'text-red-100', label: 'Verlopen' };
      default: return { bg: 'bg-gray-600', text: 'text-gray-200', label: 'Concept' };
    }
  };

  const totalStats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === 'pending').length,
    paid: invoices.filter((i) => i.status === 'paid').length,
    totalAmount: invoices.filter((i) => i.status === 'pending').reduce((sum, i) => sum + i.total_amount, 0),
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
    <div
      className="h-full overflow-y-auto relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-40 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-gold-500 rounded-2xl p-16 text-center bg-gold-500/5">
            <Upload size={56} className="text-gold-500 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gold-400">Laat los om te uploaden</p>
            <p className="text-sm text-gray-400 mt-2">
              {openaiApiKey ? 'Het bestand wordt automatisch herkend met AI' : 'Het bestand wordt handmatig toegevoegd'}
            </p>
          </div>
        </div>
      )}
      <div className="p-6 space-y-6">
        {aiNotification && (
          <div className={`flex items-center gap-3 p-4 rounded-lg border ${
            aiNotification.type === 'success'
              ? 'bg-green-900/20 border-green-800/30'
              : 'bg-red-900/20 border-red-800/30'
          }`}>
            {aiNotification.type === 'success' ? (
              <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
            )}
            <span className={`text-sm ${
              aiNotification.type === 'success' ? 'text-green-300' : 'text-red-300'
            }`}>{aiNotification.message}</span>
            <button
              onClick={() => setAiNotification(null)}
              className="ml-auto p-1 hover:bg-dark-700 rounded transition-colors"
            >
              <X size={14} className="text-gray-400" />
            </button>
          </div>
        )}

        {processingIds.size > 0 && (
          <div className="flex items-center gap-3 p-4 bg-gold-500/10 border border-gold-500/20 rounded-lg">
            <Loader2 size={18} className="text-gold-500 animate-spin flex-shrink-0" />
            <span className="text-sm text-white">
              AI herkenning bezig... De factuur wordt automatisch bijgewerkt.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-dark-900 rounded-lg border border-dark-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FileText size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-100">{totalStats.total}</p>
                <p className="text-xs text-gray-500">Totaal facturen</p>
              </div>
            </div>
          </div>
          <div className="bg-dark-900 rounded-lg border border-dark-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock size={20} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-100">{totalStats.pending}</p>
                <p className="text-xs text-gray-500">Openstaand</p>
              </div>
            </div>
          </div>
          <div className="bg-dark-900 rounded-lg border border-dark-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gold-500/10 rounded-lg">
                <AlertCircle size={20} className="text-gold-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gold-500">{formatCurrency(totalStats.totalAmount)}</p>
                <p className="text-xs text-gray-500">Te betalen</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-3 w-full sm:w-auto">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op leverancier, nummer..."
                className="w-full pl-10 pr-4 py-2.5 bg-dark-900 border border-dark-700 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-dark-900 border border-dark-700 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
            >
              <option value="all">Alle statussen</option>
              <option value="draft">Concept</option>
              <option value="pending">In Afwachting</option>
              <option value="paid">Betaald</option>
              <option value="overdue">Verlopen</option>
            </select>
          </div>
          <div className="flex gap-2">
            {ebConnected && invoices.some(inv => !inv.eboekhouden_factuur_id) && (
              <button
                onClick={handleSyncAll}
                disabled={syncingIds.size > 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 border border-green-800/40 text-green-300 rounded-lg hover:bg-green-900/20 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {syncingIds.size > 0 ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                <span className="hidden sm:inline">Alles Synchroniseren</span>
                <span className="sm:hidden">Sync</span>
              </button>
            )}
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 border border-dark-600 text-gray-200 rounded-lg hover:bg-dark-700 transition-colors text-sm font-medium"
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Upload & Herken</span>
              <span className="sm:hidden">Upload</span>
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gold-500 text-dark-950 rounded-lg hover:bg-gold-600 transition-colors text-sm font-medium"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Handmatig Toevoegen</span>
              <span className="sm:hidden">Nieuw</span>
            </button>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="bg-dark-900 rounded-lg border border-dark-700 p-12 text-center">
            <FileText size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-medium mb-2">
              {searchQuery || statusFilter !== 'all' ? 'Geen facturen gevonden' : 'Nog geen inkoopfacturen'}
            </p>
            <p className="text-gray-600 text-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'Probeer andere zoektermen of filters'
                : 'Upload een factuur of voeg er handmatig een toe'}
            </p>
          </div>
        ) : (
          <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[900px]">
                <thead>
                  <tr className="border-b border-dark-700 text-gray-400 text-xs uppercase bg-dark-800">
                    <th className="text-left px-4 py-3 font-semibold w-[22%]">Leverancier</th>
                    <th className="text-left px-4 py-3 font-semibold w-[14%]">Factuurnr.</th>
                    <th className="text-left px-4 py-3 font-semibold w-[12%]">Datum</th>
                    <th className="text-left px-4 py-3 font-semibold w-[14%]">Categorie</th>
                    <th className="text-right px-4 py-3 font-semibold w-[12%]">Bedrag</th>
                    <th className="text-center px-4 py-3 font-semibold w-[12%]">Status</th>
                    <th className="text-right px-4 py-3 font-semibold w-[14%]">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => {
                    const status = getStatusBadge(inv.status);
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-dark-800 hover:bg-dark-800 transition-colors cursor-pointer"
                        onClick={() => setPreviewInvoice(inv)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {processingIds.has(inv.id) ? (
                              <Loader2 size={14} className="text-gold-500 animate-spin flex-shrink-0" />
                            ) : inv.ai_extracted ? (
                              <Sparkles size={14} className="text-gold-500 flex-shrink-0" />
                            ) : null}
                            <span className="text-gray-100 font-medium truncate">{inv.supplier_name || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm font-mono">{inv.invoice_number || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(inv.invoice_date)}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={inv.category || ''}
                            onChange={(e) => updateCategory(inv.id, e.target.value)}
                            className="w-full bg-transparent border-none text-gray-400 text-sm capitalize cursor-pointer hover:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gold-500 rounded px-0 py-0.5"
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat.value} value={cat.value} className="bg-dark-900 text-gray-200">{cat.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-100 font-semibold">{formatCurrency(inv.total_amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            {ebConnected && (
                              inv.eboekhouden_factuur_id ? (
                                <span className="p-1.5 text-green-400" title="Gesynchroniseerd met e-Boekhouden">
                                  <Link2 size={18} />
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSyncToEBoekhouden(inv); }}
                                  disabled={syncingIds.has(inv.id)}
                                  className="text-green-400 hover:text-green-300 p-1.5 rounded hover:bg-dark-700 transition-colors disabled:opacity-50"
                                  title="Synchroniseren met e-Boekhouden"
                                >
                                  {syncingIds.has(inv.id) ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                </button>
                              )
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setPreviewInvoice(inv); }}
                              className="text-gold-500 hover:text-gold-400 p-1.5 rounded hover:bg-dark-700 transition-colors"
                              title="Bekijken"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(inv); }}
                              className="text-gray-400 hover:text-gray-200 p-1.5 rounded hover:bg-dark-700 transition-colors"
                              title="Bewerken"
                            >
                              <Edit2 size={18} />
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

      {showUpload && (
        <PurchaseInvoiceUpload
          hasApiKey={!!openaiApiKey}
          onManualEntry={handleManualEntry}
          onSaveAndProcess={handleSaveAndProcess}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-4xl mx-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between p-6 border-b border-dark-700">
              <div className="flex items-center gap-3">
                {aiExtracted && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-500/10 rounded-lg">
                    <Sparkles size={14} className="text-gold-500" />
                    <span className="text-gold-500 text-xs font-medium">AI Herkend</span>
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-100">
                  {editingId ? 'Factuur Bewerken' : 'Nieuwe Inkoopfactuur'}
                </h3>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Leverancier</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-400 mb-1">Bedrijfsnaam *</label>
                    <input
                      type="text"
                      value={formData.supplier_name}
                      onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Adres</label>
                    <input
                      type="text"
                      value={formData.supplier_address}
                      onChange={(e) => setFormData({ ...formData, supplier_address: e.target.value })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Postcode</label>
                      <input
                        type="text"
                        value={formData.supplier_postal_code}
                        onChange={(e) => setFormData({ ...formData, supplier_postal_code: e.target.value })}
                        className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Plaats</label>
                      <input
                        type="text"
                        value={formData.supplier_city}
                        onChange={(e) => setFormData({ ...formData, supplier_city: e.target.value })}
                        className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">BTW-nummer</label>
                    <input
                      type="text"
                      value={formData.supplier_vat_number}
                      onChange={(e) => setFormData({ ...formData, supplier_vat_number: e.target.value })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                      placeholder="NL000000000B00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">IBAN</label>
                    <input
                      type="text"
                      value={formData.supplier_iban}
                      onChange={(e) => setFormData({ ...formData, supplier_iban: e.target.value })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm font-mono"
                      placeholder="NL00BANK0000000000"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-6">
                <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Factuurgegevens</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Factuurnummer *</label>
                    <input
                      type="text"
                      value={formData.invoice_number}
                      onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Ordernummer</label>
                    <input
                      type="text"
                      value={formData.order_number}
                      onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Factuurdatum *</label>
                    <input
                      type="date"
                      value={formData.invoice_date}
                      onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Vervaldatum</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Categorie</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">BTW %</label>
                    <input
                      type="number"
                      value={formData.vat_rate}
                      onChange={(e) => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Notities</label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Regelitems</h4>
                  <button type="button" onClick={addLineItem} className="text-sm text-gold-500 hover:text-gold-400 font-medium">
                    + Regel toevoegen
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 uppercase font-semibold px-1">
                    <span className="col-span-5">Omschrijving</span>
                    <span className="col-span-2">Aantal</span>
                    <span className="col-span-2">Prijs</span>
                    <span className="col-span-2 text-right">Bedrag</span>
                    <span className="col-span-1"></span>
                  </div>
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                        placeholder="Omschrijving"
                        className="col-span-5 px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                        required
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="col-span-2 px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                        step="0.01"
                        required
                      />
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="col-span-2 px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm"
                        step="0.01"
                        required
                      />
                      <div className="col-span-2 px-3 py-2.5 text-gray-200 text-sm text-right font-medium">
                        {formatCurrency(item.amount)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {lineItems.length > 1 && (
                          <button type="button" onClick={() => removeLineItem(index)} className="p-1.5 hover:bg-dark-700 rounded transition-colors">
                            <Trash2 size={15} className="text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-dark-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotaal</span>
                  <span className="text-gray-200 font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">BTW ({formData.vat_rate}%)</span>
                  <span className="text-gray-200 font-medium">{formatCurrency(vatAmount)}</span>
                </div>
                <div className="flex justify-between text-lg border-t border-dark-600 pt-2 mt-2">
                  <span className="text-gray-100 font-bold">Totaal</span>
                  <span className="text-gold-500 font-bold">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 bg-dark-700 text-gray-200 rounded-lg hover:bg-dark-600 transition-colors font-medium"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gold-500 text-dark-950 rounded-lg hover:bg-gold-600 transition-colors font-medium"
                >
                  {editingId ? 'Factuur Bijwerken' : 'Factuur Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewInvoice && (
        <PurchaseInvoicePreview
          invoice={previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          onEdit={() => startEdit(previewInvoice)}
          onDelete={() => setDeleteConfirm(previewInvoice.id)}
          onMarkAsPaid={previewInvoice.status !== 'paid' ? () => markAsPaid(previewInvoice.id) : undefined}
        />
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Factuur Verwijderen"
          message={`Weet je zeker dat je de factuur van "${invoices.find(i => i.id === deleteConfirm)?.supplier_name || ''}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
          confirmText="Verwijderen"
          cancelText="Annuleren"
          variant="danger"
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
