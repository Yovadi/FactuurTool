import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Database, RefreshCw, Loader2, XCircle, FileText,
  Square, CheckSquare, AlertTriangle, Link2, Receipt, ShoppingCart
} from 'lucide-react';
import { resyncCreditNoteToEBoekhouden, resyncPurchaseInvoiceToEBoekhouden } from '../lib/eboekhoudenSync';

type SyncedRecord = {
  id: string;
  number: string;
  date: string;
  amount: number;
  eboekhouden_id: number | null;
  eboekhouden_synced_at: string | null;
  eboekhouden_not_found: boolean;
  customer_name: string;
  type: 'credit_note' | 'purchase_invoice';
};

export function CrediteurenEBoekhouden() {
  const [records, setRecords] = useState<SyncedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [bulkResyncing, setBulkResyncing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'credit_note' | 'purchase_invoice'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, creditNotesRes, purchaseInvoicesRes] = await Promise.all([
        supabase.from('company_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase
          .from('credit_notes')
          .select(`
            id, credit_note_number, credit_date, total_amount,
            eboekhouden_id, eboekhouden_synced_at, eboekhouden_not_found,
            tenant_id, external_customer_id,
            tenants (name, company_name),
            external_customers (company_name, contact_name)
          `)
          .not('eboekhouden_id', 'is', null)
          .order('eboekhouden_synced_at', { ascending: false }),
        supabase
          .from('purchase_invoices')
          .select(`
            id, invoice_number, invoice_date, total_amount,
            eboekhouden_factuur_id, eboekhouden_synced_at, eboekhouden_not_found,
            supplier_name
          `)
          .not('eboekhouden_factuur_id', 'is', null)
          .order('eboekhouden_synced_at', { ascending: false }),
      ]);

      setCompanySettings(settingsRes.data || null);

      const cnRecords: SyncedRecord[] = (creditNotesRes.data || []).map((cn: any) => {
        const tenant = Array.isArray(cn.tenants) ? cn.tenants[0] : cn.tenants;
        const ext = Array.isArray(cn.external_customers) ? cn.external_customers[0] : cn.external_customers;
        return {
          id: cn.id,
          number: cn.credit_note_number,
          date: cn.credit_date,
          amount: cn.total_amount,
          eboekhouden_id: cn.eboekhouden_id,
          eboekhouden_synced_at: cn.eboekhouden_synced_at,
          eboekhouden_not_found: cn.eboekhouden_not_found ?? false,
          customer_name: cn.tenant_id
            ? (tenant?.company_name || tenant?.name || '-')
            : (ext?.company_name || ext?.contact_name || '-'),
          type: 'credit_note',
        };
      });

      const piRecords: SyncedRecord[] = (purchaseInvoicesRes.data || []).map((pi: any) => ({
        id: pi.id,
        number: pi.invoice_number,
        date: pi.invoice_date,
        amount: pi.total_amount,
        eboekhouden_id: pi.eboekhouden_factuur_id,
        eboekhouden_synced_at: pi.eboekhouden_synced_at,
        eboekhouden_not_found: pi.eboekhouden_not_found ?? false,
        customer_name: pi.supplier_name || '-',
        type: 'purchase_invoice',
      }));

      const all = [...cnRecords, ...piRecords].sort((a, b) => {
        if (!a.eboekhouden_synced_at) return 1;
        if (!b.eboekhouden_synced_at) return -1;
        return new Date(b.eboekhouden_synced_at).getTime() - new Date(a.eboekhouden_synced_at).getTime();
      });

      setRecords(all);
    } finally {
      setLoading(false);
    }
  };

  const flagNotFound = async (record: SyncedRecord) => {
    const table = record.type === 'credit_note' ? 'credit_notes' : 'purchase_invoices';
    await supabase.from(table).update({ eboekhouden_not_found: true }).eq('id', record.id);
  };

  const clearNotFound = async (record: SyncedRecord) => {
    const table = record.type === 'credit_note' ? 'credit_notes' : 'purchase_invoices';
    await supabase.from(table).update({ eboekhouden_not_found: false }).eq('id', record.id);
  };

  const handleResync = async (record: SyncedRecord) => {
    if (!companySettings?.eboekhouden_api_token) return;

    const confirmed = confirm(
      `Weet je zeker dat je "${record.number}" opnieuw wilt synchroniseren?\n\nDit vervangt de bestaande record in e-Boekhouden.`
    );
    if (!confirmed) return;

    setResyncingId(record.id);
    const result = record.type === 'credit_note'
      ? await resyncCreditNoteToEBoekhouden(companySettings.eboekhouden_api_token, record.id, companySettings)
      : await resyncPurchaseInvoiceToEBoekhouden(companySettings.eboekhouden_api_token, record.id, companySettings);

    if (result.success) {
      await clearNotFound(record);
    } else if (result.error?.toLowerCase().includes('niet gevonden') || result.error?.toLowerCase().includes('not found')) {
      await flagNotFound(record);
    }
    setResyncingId(null);
    await loadData();
    if (!result.success) alert(result.error || 'Synchronisatie mislukt');
  };

  const handleResetSync = async (record: SyncedRecord) => {
    const confirmed = confirm(
      `Weet je zeker dat je de sync status van "${record.number}" wilt resetten?\n\nDe koppeling met e-Boekhouden wordt verwijderd.`
    );
    if (!confirmed) return;

    const table = record.type === 'credit_note' ? 'credit_notes' : 'purchase_invoices';
    const updates = record.type === 'credit_note'
      ? { eboekhouden_id: null, eboekhouden_synced_at: null, eboekhouden_not_found: false }
      : { eboekhouden_factuur_id: null, eboekhouden_synced_at: null, eboekhouden_not_found: false };

    await supabase.from(table).update(updates).eq('id', record.id);
    await loadData();
  };

  const handleBulkResync = async () => {
    if (!companySettings?.eboekhouden_api_token || selectedIds.size === 0) return;
    const confirmed = confirm(`Weet je zeker dat je ${selectedIds.size} record(s) opnieuw wilt synchroniseren?`);
    if (!confirmed) return;

    setBulkResyncing(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ids.length; i++) {
      const record = records.find(r => r.id === ids[i]);
      if (!record) continue;

      const result = record.type === 'credit_note'
        ? await resyncCreditNoteToEBoekhouden(companySettings.eboekhouden_api_token, record.id, companySettings)
        : await resyncPurchaseInvoiceToEBoekhouden(companySettings.eboekhouden_api_token, record.id, companySettings);

      if (result.success) {
        await clearNotFound(record);
        successCount++;
      } else {
        if (result.error?.toLowerCase().includes('niet gevonden') || result.error?.toLowerCase().includes('not found')) {
          await flagNotFound(record);
        }
        failCount++;
      }
      setBulkProgress({ done: i + 1, total: ids.length });
    }

    setBulkResyncing(false);
    setBulkProgress(null);
    setSelectedIds(new Set());
    await loadData();
    alert(`Klaar: ${successCount} geslaagd, ${failCount} mislukt.`);
  };

  const filteredRecords = activeFilter === 'all' ? records : records.filter(r => r.type === activeFilter);
  const allSelected = selectedIds.size === filteredRecords.length && filteredRecords.length > 0;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filteredRecords.map(r => r.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('nl-NL');
  const formatDateTime = (d: string) => {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('nl-NL')} ${dt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (!companySettings?.eboekhouden_connected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Database size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">e-Boekhouden is niet geconfigureerd</p>
          <p className="text-sm text-gray-500 mt-2">Configureer e-Boekhouden in de bedrijfsinstellingen</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
      <div className="flex-shrink-0 bg-dark-800 border-b border-gold-500 px-4 py-3 flex items-center gap-2">
        <Database size={20} className="text-gold-500" />
        <h3 className="text-lg font-bold text-gray-100">e-Boekhouden Synchronisatie</h3>
      </div>

      <div className="flex-shrink-0 px-4 py-3 bg-blue-900/10 border-b border-dark-600 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeFilter === 'all' ? 'bg-gold-600 text-dark-900' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Alle ({records.length})
            </button>
            <button
              onClick={() => setActiveFilter('credit_note')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeFilter === 'credit_note' ? 'bg-gold-600 text-dark-900' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <Receipt size={13} />
              Credit Nota's ({records.filter(r => r.type === 'credit_note').length})
            </button>
            <button
              onClick={() => setActiveFilter('purchase_invoice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeFilter === 'purchase_invoice' ? 'bg-gold-600 text-dark-900' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <ShoppingCart size={13} />
              Inkoopfacturen ({records.filter(r => r.type === 'purchase_invoice').length})
            </button>
          </div>
          <span className="text-xs text-gray-500">
            <AlertTriangle size={11} className="inline text-amber-400 mr-1" />
            Oranje = niet gevonden in e-Boekhouden
          </span>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkResync}
            disabled={bulkResyncing}
            className="flex items-center gap-2 px-3 py-1.5 bg-gold-600 hover:bg-gold-500 text-dark-900 font-medium text-sm rounded-lg transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {bulkResyncing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {bulkProgress ? `${bulkProgress.done}/${bulkProgress.total}` : 'Bezig...'}
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                {selectedIds.size} opnieuw synchroniseren
              </>
            )}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Loader2 size={48} className="text-gold-500 mx-auto mb-4 animate-spin" />
            <p className="text-gray-400">Laden...</p>
          </div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <FileText size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Geen gesynchroniseerde records</p>
            <p className="text-sm text-gray-500 mt-2">Records die naar e-Boekhouden zijn gesynchroniseerd verschijnen hier</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-dark-800 sticky top-0 border-b border-dark-700">
              <tr>
                <th className="px-3 py-3">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-200 transition-colors">
                    {allSelected ? <CheckSquare size={16} className="text-gold-500" /> : <Square size={16} />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-gray-300 font-medium text-sm">Type</th>
                <th className="text-left px-4 py-3 text-gray-300 font-medium text-sm">Nummer</th>
                <th className="text-left px-4 py-3 text-gray-300 font-medium text-sm">Klant / Leverancier</th>
                <th className="text-left px-4 py-3 text-gray-300 font-medium text-sm">Datum</th>
                <th className="text-right px-4 py-3 text-gray-300 font-medium text-sm">Bedrag</th>
                <th className="text-left px-4 py-3 text-gray-300 font-medium text-sm">e-Boekhouden ID</th>
                <th className="text-right px-4 py-3 text-gray-300 font-medium text-sm">Gesynchroniseerd</th>
                <th className="text-center px-4 py-3 text-gray-300 font-medium text-sm">Acties</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const isSelected = selectedIds.has(record.id);
                const isNotFound = record.eboekhouden_not_found;

                return (
                  <tr
                    key={record.id}
                    className={`border-b transition-colors ${
                      isNotFound
                        ? 'border-amber-900/40 bg-amber-950/20 hover:bg-amber-950/30'
                        : isSelected
                        ? 'border-dark-700 bg-dark-700/60 hover:bg-dark-700'
                        : 'border-dark-800 hover:bg-dark-800'
                    }`}
                  >
                    <td className="px-3 py-3">
                      <button onClick={() => toggleSelect(record.id)} className="text-gray-400 hover:text-gray-200 transition-colors">
                        {isSelected ? <CheckSquare size={16} className="text-gold-500" /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {record.type === 'credit_note' ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-900/30 text-red-400 border border-red-800/30 rounded px-2 py-0.5">
                          <Receipt size={11} />
                          Credit Nota
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-900/30 text-blue-400 border border-blue-800/30 rounded px-2 py-0.5">
                          <ShoppingCart size={11} />
                          Inkoop
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className={isNotFound ? 'text-amber-400' : 'text-gray-200'}>{record.number}</span>
                      {isNotFound && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-500 bg-amber-950/40 border border-amber-800/40 rounded px-1.5 py-0.5">
                          <AlertTriangle size={10} /> Niet gevonden
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{record.customer_name}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(record.date)}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {record.type === 'credit_note'
                        ? <span className="text-red-400">-€{Number(record.amount).toFixed(2)}</span>
                        : <span className="text-gray-200">€{Number(record.amount).toFixed(2)}</span>
                      }
                    </td>
                    <td className={`px-4 py-3 font-mono text-sm ${isNotFound ? 'text-amber-600 line-through' : 'text-gray-400'}`}>
                      {record.eboekhouden_id ? (
                        <span className="flex items-center gap-1">
                          <Link2 size={12} className={isNotFound ? 'text-amber-600' : 'text-green-500'} />
                          {record.eboekhouden_id}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">
                      {record.eboekhouden_synced_at ? formatDateTime(record.eboekhouden_synced_at) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleResync(record)}
                          disabled={resyncingId === record.id || bulkResyncing}
                          className="p-2 text-gray-400 hover:text-gold-500 hover:bg-dark-700 transition-colors disabled:opacity-50 rounded"
                          title="Opnieuw synchroniseren"
                        >
                          {resyncingId === record.id
                            ? <Loader2 size={16} className="animate-spin" />
                            : <RefreshCw size={16} />
                          }
                        </button>
                        <button
                          onClick={() => handleResetSync(record)}
                          disabled={bulkResyncing}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-dark-700 transition-colors disabled:opacity-50 rounded"
                          title="Reset sync status"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
