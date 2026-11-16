import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, RefreshCw, Shield } from 'lucide-react';
import { Toast } from './Toast';
import {
  BORGFACTUUR_NOTES,
  getLeaseLeadMonth,
  getLeaseStartMonth,
  isBorgfactuurNote,
  resolveDepositInvoice,
} from '../utils/leaseInvoiceEligibility';

type BorgInvoice = {
  id: string;
  lease_id: string | null;
  invoice_number: string;
  amount: number;
  status: string;
  invoice_date: string;
  notes: string | null;
};

type LeaseRow = {
  id: string;
  tenant_id: string;
  status: string;
  start_date: string;
  end_date: string;
  deposit_amount?: number | string | null;
  tenant?: { company_name?: string; name?: string } | { company_name?: string; name?: string }[] | null;
  lease_spaces?: { space?: { space_number?: string } | { space_number?: string }[] | null }[];
};

type OverviewRow = {
  lease: LeaseRow;
  tenantName: string;
  spaces: string;
  agreed: number;
  paid: number;
  open: number;
  invoice: BorgInvoice | null;
  canCreate: boolean;
};

type DepositOverviewProps = {
  isActive?: boolean;
};

const euro = (value: number) =>
  value.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

function tenantNameOf(lease: LeaseRow): string {
  const tenant = Array.isArray(lease.tenant) ? lease.tenant[0] : lease.tenant;
  return tenant?.company_name || tenant?.name || 'Onbekende huurder';
}

function spacesOf(lease: LeaseRow): string {
  const names = (lease.lease_spaces || []).map(entry => {
    const space = Array.isArray(entry.space) ? entry.space[0] : entry.space;
    return space?.space_number || '';
  }).filter(Boolean);
  return names.join(', ');
}

function invoiceRank(invoice: BorgInvoice): number {
  if (invoice.status === 'draft') return 0;
  if (invoice.status === 'overdue') return 1;
  if (invoice.status === 'sent') return 2;
  if (invoice.status === 'paid') return 3;
  return 4;
}

function statusLabel(invoice: BorgInvoice | null, paid: number, agreed: number): { text: string; className: string } {
  if (!invoice) {
    return { text: 'Nog niet gefactureerd', className: 'bg-dark-700 text-gray-300' };
  }
  if (invoice.status === 'paid' || (agreed > 0 && paid >= agreed)) {
    return { text: 'Betaald', className: 'bg-emerald-900/50 text-emerald-300' };
  }
  if (paid > 0) {
    return { text: 'Deels betaald', className: 'bg-amber-900/50 text-amber-300' };
  }
  if (invoice.status === 'draft') {
    return { text: 'Concept', className: 'bg-dark-700 text-gray-200' };
  }
  if (invoice.status === 'overdue') {
    return { text: 'Achterstallig', className: 'bg-red-900/50 text-red-300' };
  }
  return { text: 'Verstuurd', className: 'bg-blue-900/50 text-blue-300' };
}

export function DepositOverview({ isActive = true }: DepositOverviewProps) {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const leaseSelect = `
      id, tenant_id, status, start_date, end_date, deposit_amount,
      tenant:tenants(company_name, name),
      lease_spaces(space:office_spaces(space_number))
    `;
    let leaseResult = await supabase.from('leases').select(leaseSelect);
    if (leaseResult.error) {
      leaseResult = await supabase.from('leases').select(`
        id, tenant_id, status, start_date, end_date,
        tenant:tenants(company_name, name),
        lease_spaces(space:office_spaces(space_number))
      `);
    }

    const { data: invoiceRows } = await supabase
      .from('invoices')
      .select('id, lease_id, invoice_number, amount, status, notes, invoice_date')
      .not('lease_id', 'is', null);

    const borgInvoices = ((invoiceRows || []) as BorgInvoice[]).filter(
      invoice => invoice.status !== 'credited' && isBorgfactuurNote(invoice.notes)
    );
    const byLease = new Map<string, BorgInvoice[]>();
    for (const invoice of borgInvoices) {
      if (!invoice.lease_id) continue;
      const list = byLease.get(invoice.lease_id) || [];
      list.push(invoice);
      byLease.set(invoice.lease_id, list);
    }

    const nextRows: OverviewRow[] = [];
    for (const lease of (leaseResult.data || []) as LeaseRow[]) {
      const invoices = byLease.get(lease.id) || [];
      const agreed = Number(lease.deposit_amount) || 0;
      if (agreed <= 0 && invoices.length === 0) continue;

      const paid = invoices
        .filter(invoice => invoice.status === 'paid')
        .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
      const invoice = [...invoices].sort((a, b) => invoiceRank(a) - invoiceRank(b) || b.invoice_date.localeCompare(a.invoice_date))[0] || null;
      const open = Math.max(0, Math.round(((agreed || invoices.reduce((sum, item) => sum + Number(item.amount || 0), 0)) - paid) * 100) / 100);
      const canCreate = !invoices.length && !!resolveDepositInvoice(lease, depositSelectionMonth(lease), []);

      nextRows.push({
        lease,
        tenantName: tenantNameOf(lease),
        spaces: spacesOf(lease),
        agreed: Math.round(agreed * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        open,
        invoice,
        canCreate,
      });
    }

    nextRows.sort((a, b) => a.tenantName.localeCompare(b.tenantName, 'nl'));
    setRows(nextRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isActive) load();
  }, [isActive, load]);

  const createInvoice = async (row: OverviewRow) => {
    const month = depositSelectionMonth(row.lease);
    const target = resolveDepositInvoice(row.lease, month, []);
    if (!target?.eligible || !target.amount) {
      showToast('Voor dit contract kan nu geen borgfactuur worden gemaakt.', 'error');
      return;
    }

    setCreatingId(row.lease.id);
    try {
      const { data: settings } = await supabase.from('company_settings').select('test_mode, test_date').maybeSingle();
      let currentDate = new Date();
      if (settings?.test_mode === true && settings?.test_date) currentDate = new Date(settings.test_date);
      const invoiceDate = currentDate.toISOString().split('T')[0];
      const due = new Date(currentDate);
      due.setDate(due.getDate() + 14);

      const { data: invoiceNumber, error: numberError } = await supabase.rpc('generate_invoice_number');
      if (numberError || !invoiceNumber) throw numberError || new Error('Geen factuurnummer');

      const { data: created, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          lease_id: row.lease.id,
          tenant_id: row.lease.tenant_id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: due.toISOString().split('T')[0],
          invoice_month: target.invoiceMonth,
          subtotal: target.amount,
          vat_amount: 0,
          amount: target.amount,
          vat_rate: 0,
          vat_inclusive: false,
          status: 'draft',
          notes: target.notes || BORGFACTUUR_NOTES,
        }])
        .select('id')
        .single();
      if (invoiceError || !created) throw invoiceError || new Error('Factuur niet aangemaakt');

      const { error: lineError } = await supabase.from('invoice_line_items').insert([{
        invoice_id: created.id,
        description: 'Waarborgsom',
        quantity: 1,
        unit_price: target.amount,
        amount: target.amount,
        local_category: null,
      }]);
      if (lineError) {
        await supabase.from('invoices').delete().eq('id', created.id);
        throw lineError;
      }

      showToast(`Borgfactuur ${invoiceNumber} staat als concept. Verstuur deze los van de huur.`, 'success');
      await load();
    } catch (error) {
      console.error('Error creating deposit invoice:', error);
      showToast('De borgfactuur kon niet worden aangemaakt.', 'error');
    } finally {
      setCreatingId(null);
    }
  };

  const agreedTotal = rows.reduce((sum, row) => sum + row.agreed, 0);
  const paidTotal = rows.reduce((sum, row) => sum + row.paid, 0);
  const openTotal = rows.reduce((sum, row) => sum + row.open, 0);

  return (
    <div className="h-full overflow-y-auto space-y-4">
      <div className="bg-dark-900 rounded-lg border border-dark-700 p-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <Shield size={18} className="text-amber-400" />
            Borg per huurder
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            De waarborgsom is een eigen factuur. Die maak en verstuur je los van de maandhuur. Aan het einde van het contract wordt het bedrag teruggestort.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
          title="Vernieuwen"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard label="Afgesproken" value={euro(agreedTotal)} />
        <SummaryCard label="Betaald" value={euro(paidTotal)} accent="text-emerald-300" />
        <SummaryCard label="Nog te ontvangen" value={euro(openTotal)} accent="text-amber-300" />
      </div>

      <div className="bg-dark-900 rounded-lg border border-dark-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-gold-500 animate-spin" size={28} />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-16 px-6">
            Er is nog geen borg vastgelegd. Vul bij een contract het veld Borg (waarborgsom) in. Daarna kun je hier een aparte factuur maken.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-dark-700 text-gray-400 text-xs uppercase">
                  <th className="text-left px-4 py-3 font-semibold">Huurder</th>
                  <th className="text-right px-4 py-3 font-semibold">Afgesproken</th>
                  <th className="text-right px-4 py-3 font-semibold">Betaald</th>
                  <th className="text-right px-4 py-3 font-semibold">Open</th>
                  <th className="text-left px-4 py-3 font-semibold">Factuur</th>
                  <th className="text-right px-4 py-3 font-semibold">Actie</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const status = statusLabel(row.invoice, row.paid, row.agreed);
                  return (
                    <tr key={row.lease.id} className="border-b border-dark-700/70">
                      <td className="px-4 py-3">
                        <div className="text-gray-100 font-medium">{row.tenantName}</div>
                        <div className="text-xs text-gray-500">
                          {row.spaces || 'Geen ruimte'}
                          {row.lease.status !== 'active' ? ' · contract niet actief' : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-100">{euro(row.agreed)}</td>
                      <td className="px-4 py-3 text-right text-emerald-300">{euro(row.paid)}</td>
                      <td className="px-4 py-3 text-right text-amber-200">{euro(row.open)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${status.className}`}>{status.text}</span>
                          {row.invoice && (
                            <span className="text-xs text-gray-400">{row.invoice.invoice_number}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.canCreate ? (
                          <button
                            onClick={() => createInvoice(row)}
                            disabled={creatingId === row.lease.id}
                            className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-500 disabled:opacity-50"
                          >
                            {creatingId === row.lease.id ? 'Bezig...' : 'Borgfactuur maken'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {row.invoice?.status === 'draft' ? 'Verstuur via Facturen' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toasts.map(toast => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToasts(prev => prev.filter(item => item.id !== toast.id))} />
      ))}
    </div>
  );
}

function SummaryCard({ label, value, accent = 'text-gray-100' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-dark-900 rounded-lg border border-dark-700 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

function depositSelectionMonth(lease: { start_date?: string | null; end_date?: string | null }): string {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lead = getLeaseLeadMonth(lease);
  const start = getLeaseStartMonth(lease);
  if (resolveDepositInvoice(lease, current, [])) return current;
  if (lead && resolveDepositInvoice(lease, lead, [])) return lead;
  if (start && resolveDepositInvoice(lease, start, [])) return start;
  return current;
}
