import { useState, useEffect } from 'react';
import { supabase, type CompanySettings, type EBoekhoudenSyncLog, type EBoekhoudenGrootboekMapping, type Tenant, type ExternalCustomer } from '../lib/supabase';
import { testConnection, getLedgerAccounts, getInvoiceTemplates, diagnoseConnection } from '../lib/eboekhouden';
import { syncRelationToEBoekhouden } from '../lib/eboekhoudenSync';
import {
  Link2, CheckCircle2, XCircle, Loader2, RefreshCw,
  BookOpen, Users, FileText, ArrowUpRight, ArrowDownRight,
  Clock, AlertTriangle, Activity, Database, Settings2, Plus, Trash2, Edit2, Upload
} from 'lucide-react';

interface SyncStats {
  tenantsTotal: number;
  tenantsSynced: number;
  externalTotal: number;
  externalSynced: number;
  invoicesTotal: number;
  invoicesSynced: number;
  creditNotesTotal: number;
  creditNotesSynced: number;
  purchaseInvoicesTotal: number;
  purchaseInvoicesSynced: number;
}

interface LedgerAccount {
  id: number;
  code: string;
  description: string;
  category: string;
}

export function EBoekhoudenDashboard() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats>({
    tenantsTotal: 0, tenantsSynced: 0,
    externalTotal: 0, externalSynced: 0,
    invoicesTotal: 0, invoicesSynced: 0,
    creditNotesTotal: 0, creditNotesSynced: 0,
    purchaseInvoicesTotal: 0, purchaseInvoicesSynced: 0,
  });
  const [syncLogs, setSyncLogs] = useState<EBoekhoudenSyncLog[]>([]);
  const [mappings, setMappings] = useState<EBoekhoudenGrootboekMapping[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showMappingForm, setShowMappingForm] = useState(false);
  const [mappingForm, setMappingForm] = useState({ local_category: '', grootboek_code: '', grootboek_omschrijving: '', btw_code: '' });
  const [mappingSaving, setMappingSaving] = useState(false);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSaving, setTokenSaving] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<Record<string, unknown> | null>(null);
  const [syncingRelations, setSyncingRelations] = useState(false);
  const [syncRelationResult, setSyncRelationResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [invoiceTemplates, setInvoiceTemplates] = useState<{ id: number; name: string }[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();
    setSettings(data);
    return data;
  };

  const loadDashboardData = async () => {
    setLoading(true);
    await Promise.all([loadSettings(), loadSyncStats(), loadSyncLogs(), loadMappings()]);
    setLoading(false);
  };

  const loadSyncStats = async () => {
    const [tenants, external, invoices, creditNotes, purchaseInvoices] = await Promise.all([
      supabase.from('tenants').select('id, eboekhouden_relatie_id'),
      supabase.from('external_customers').select('id, eboekhouden_relatie_id'),
      supabase.from('invoices').select('id, eboekhouden_factuur_id'),
      supabase.from('credit_notes').select('id, eboekhouden_id'),
      supabase.from('purchase_invoices').select('id, eboekhouden_factuur_id'),
    ]);

    setSyncStats({
      tenantsTotal: tenants.data?.length || 0,
      tenantsSynced: tenants.data?.filter(t => t.eboekhouden_relatie_id).length || 0,
      externalTotal: external.data?.length || 0,
      externalSynced: external.data?.filter(e => e.eboekhouden_relatie_id).length || 0,
      invoicesTotal: invoices.data?.length || 0,
      invoicesSynced: invoices.data?.filter(i => i.eboekhouden_factuur_id).length || 0,
      creditNotesTotal: creditNotes.data?.length || 0,
      creditNotesSynced: creditNotes.data?.filter(c => c.eboekhouden_id).length || 0,
      purchaseInvoicesTotal: purchaseInvoices.data?.length || 0,
      purchaseInvoicesSynced: purchaseInvoices.data?.filter(p => p.eboekhouden_factuur_id).length || 0,
    });
  };

  const loadSyncLogs = async () => {
    const { data } = await supabase
      .from('eboekhouden_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setSyncLogs(data || []);
  };

  const loadMappings = async () => {
    const { data } = await supabase
      .from('eboekhouden_grootboek_mapping')
      .select('*')
      .order('local_category');
    setMappings(data || []);
  };

  const handleTestConnection = async () => {
    if (!settings?.eboekhouden_api_token) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await testConnection(settings.eboekhouden_api_token);
      if (result.success) {
        setTestResult({ success: true, message: 'Verbinding succesvol!' });
        if (!settings.eboekhouden_connected) {
          await supabase
            .from('company_settings')
            .update({ eboekhouden_connected: true, updated_at: new Date().toISOString() })
            .eq('id', settings.id);
          setSettings({ ...settings, eboekhouden_connected: true });
        }
      } else {
        const errorMsg = result.error || 'Verbinding mislukt';
        setTestResult({ success: false, message: errorMsg });
        if (settings.eboekhouden_connected) {
          await supabase
            .from('company_settings')
            .update({ eboekhouden_connected: false, updated_at: new Date().toISOString() })
            .eq('id', settings.id);
          setSettings({ ...settings, eboekhouden_connected: false });
        }
      }
    } catch {
      setTestResult({ success: false, message: 'Fout bij het testen van de verbinding' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleDiagnose = async () => {
    if (!settings?.eboekhouden_api_token) return;
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const result = await diagnoseConnection(settings.eboekhouden_api_token);
      setDiagResult((result as { diagnostics?: Record<string, unknown> }).diagnostics || result as Record<string, unknown>);
    } catch {
      setDiagResult({ error: 'Diagnose kon niet worden uitgevoerd' });
    } finally {
      setDiagLoading(false);
    }
  };

  const handleLoadLedger = async () => {
    if (!settings?.eboekhouden_api_token) return;
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const result = await getLedgerAccounts(settings.eboekhouden_api_token);
      if (!result.success) {
        setLedgerError(result.error || 'Kon grootboekrekeningen niet ophalen');
        setShowLedger(true);
        return;
      }

      let accounts: any[] = [];
      if (Array.isArray(result.data)) {
        accounts = result.data;
      } else if (result.data && typeof result.data === 'object') {
        const dataObj = result.data as Record<string, unknown>;
        if (Array.isArray(dataObj.results)) {
          accounts = dataObj.results;
        } else if (Array.isArray(dataObj.Results)) {
          accounts = dataObj.Results;
        } else if (Array.isArray(dataObj.items)) {
          accounts = dataObj.items;
        } else {
          const firstArray = Object.values(dataObj).find(v => Array.isArray(v));
          if (firstArray) {
            accounts = firstArray as any[];
          }
        }
      }

      setLedgerAccounts(accounts.map((acc: any) => ({
        id: acc.id || acc.Id || 0,
        code: acc.code || acc.Code || '',
        description: acc.description || acc.Description || '',
        category: acc.category || acc.Category || '',
      })));
      setShowLedger(true);
    } catch (err) {
      setLedgerError(err instanceof Error ? err.message : 'Onbekende fout bij ophalen grootboekrekeningen');
      setShowLedger(true);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleSaveMapping = async () => {
    if (!mappingForm.local_category || !mappingForm.grootboek_code) return;
    setMappingSaving(true);
    const { error } = await supabase
      .from('eboekhouden_grootboek_mapping')
      .upsert({
        local_category: mappingForm.local_category,
        grootboek_code: mappingForm.grootboek_code,
        grootboek_omschrijving: mappingForm.grootboek_omschrijving,
        btw_code: mappingForm.btw_code || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'local_category' });
    if (!error) {
      setShowMappingForm(false);
      setMappingForm({ local_category: '', grootboek_code: '', grootboek_omschrijving: '', btw_code: '' });
      await loadMappings();
    }
    setMappingSaving(false);
  };

  const handleDeleteMapping = async (id: string) => {
    await supabase.from('eboekhouden_grootboek_mapping').delete().eq('id', id);
    await loadMappings();
  };

  const handleSaveToken = async () => {
    if (!settings) return;
    setTokenSaving(true);
    const { error } = await supabase
      .from('company_settings')
      .update({
        eboekhouden_api_token: tokenInput || null,
        eboekhouden_connected: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id);
    if (!error) {
      setSettings({ ...settings, eboekhouden_api_token: tokenInput || null, eboekhouden_connected: false });
      setShowTokenForm(false);
      setTokenInput('');
    }
    setTokenSaving(false);
  };

  const handleSyncAllRelations = async () => {
    if (!settings?.eboekhouden_api_token) return;
    setSyncingRelations(true);
    setSyncRelationResult(null);

    const apiToken = settings.eboekhouden_api_token;
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    const { data: tenants } = await supabase
      .from('tenants')
      .select('*')
      .is('eboekhouden_relatie_id', null);

    const { data: externals } = await supabase
      .from('external_customers')
      .select('*')
      .is('eboekhouden_relatie_id', null);

    for (const tenant of (tenants || []) as Tenant[]) {
      const result = await syncRelationToEBoekhouden(apiToken, tenant, 'tenant');
      if (result.success) {
        success++;
      } else {
        failed++;
        errors.push(`${tenant.company_name || tenant.name}: ${result.error || 'Onbekende fout'}`);
      }
    }

    for (const ext of (externals || []) as ExternalCustomer[]) {
      const result = await syncRelationToEBoekhouden(apiToken, ext, 'external');
      if (result.success) {
        success++;
      } else {
        failed++;
        errors.push(`${ext.company_name || ext.contact_name}: ${result.error || 'Onbekende fout'}`);
      }
    }

    setSyncRelationResult({ success, failed, errors });
    setSyncingRelations(false);
    await loadSyncStats();
    await loadSyncLogs();
  };

  const handleLoadInvoiceTemplates = async () => {
    if (!settings?.eboekhouden_api_token) return;
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const result = await getInvoiceTemplates(settings.eboekhouden_api_token);
      if (!result.success) {
        setTemplatesError(result.error || 'Kon factuursjablonen niet ophalen');
        return;
      }
      let templates: any[] = [];
      if (Array.isArray(result.data)) {
        templates = result.data;
      } else if (result.data && typeof result.data === 'object') {
        const dataObj = result.data as Record<string, unknown>;
        const firstArray = Object.values(dataObj).find(v => Array.isArray(v));
        if (firstArray) templates = firstArray as any[];
      }
      setInvoiceTemplates(templates.map((t: any) => ({
        id: t.id || t.Id || 0,
        name: t.name || t.Name || t.description || t.Description || `Sjabloon ${t.id || t.Id}`,
      })));
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : 'Fout bij ophalen sjablonen');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleSaveTemplateId = async (templateId: number) => {
    if (!settings) return;
    setTemplateSaving(true);
    const { error } = await supabase
      .from('company_settings')
      .update({ eboekhouden_template_id: templateId, updated_at: new Date().toISOString() })
      .eq('id', settings.id);
    if (!error) {
      setSettings({ ...settings, eboekhouden_template_id: templateId });
    }
    setTemplateSaving(false);
  };

  const connected = settings?.eboekhouden_connected ?? false;
  const hasToken = !!settings?.eboekhouden_api_token;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={20} className="text-gold-500" />
          <h3 className="text-lg font-semibold text-gray-100">e-Boekhouden Integratie</h3>
        </div>
        {hasToken && (
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <RefreshCw size={14} />
            Vernieuwen
          </button>
        )}
      </div>

      <div className={`rounded-lg p-4 border ${connected ? 'bg-green-900/10 border-green-800/30' : hasToken ? 'bg-yellow-900/10 border-yellow-800/30' : 'bg-dark-800 border-dark-700'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : hasToken ? 'bg-yellow-500' : 'bg-gray-600'}`} />
            <div>
              <p className="text-gray-100 font-medium">
                {connected ? 'Verbonden met e-Boekhouden' : hasToken ? 'Token ingesteld - niet geverifieerd' : 'Niet verbonden'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {hasToken
                  ? `Token: ...${settings!.eboekhouden_api_token!.slice(-6)}`
                  : 'Voeg je API token toe om te verbinden'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTokenInput(settings?.eboekhouden_api_token || '');
                setShowTokenForm(!showTokenForm);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gold-500 hover:text-gold-400 transition-colors border border-dark-600 hover:border-gold-500/30"
            >
              <Edit2 size={14} />
              Bewerken
            </button>
            {hasToken && (
              <button
                onClick={handleTestConnection}
                disabled={testLoading}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                  connected
                    ? 'bg-green-900/20 text-green-300 hover:bg-green-900/30 border border-green-800/30'
                    : 'bg-dark-700 text-gray-200 hover:bg-dark-600 border border-dark-600'
                }`}
              >
                {testLoading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                Test Verbinding
              </button>
            )}
          </div>
        </div>
        {showTokenForm && (
          <div className="mt-4 pt-4 border-t border-dark-700">
            <label className="block text-sm font-medium text-gray-300 mb-2">API Token</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Plak hier je e-Boekhouden API token"
                className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
              <button
                onClick={handleSaveToken}
                disabled={tokenSaving}
                className="flex items-center gap-1.5 bg-gold-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gold-600 transition-colors disabled:opacity-50"
              >
                {tokenSaving && <Loader2 size={14} className="animate-spin" />}
                Opslaan
              </button>
              <button
                onClick={() => setShowTokenForm(false)}
                className="px-3 py-2 text-gray-400 hover:text-gray-200 text-sm transition-colors"
              >
                Annuleren
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Je vindt je API token in e-Boekhouden onder Beheer &gt; Instellingen &gt; API / Koppelingen
            </p>
          </div>
        )}
        {testResult && (
          <div className={`mt-3 flex items-center gap-1.5 text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
            {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {testResult.message}
          </div>
        )}
        {testResult && !testResult.success && hasToken && (
          <div className="mt-2">
            <button
              onClick={handleDiagnose}
              disabled={diagLoading}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              {diagLoading ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
              Diagnose uitvoeren
            </button>
          </div>
        )}
        {diagResult && (
          <div className="mt-3 bg-dark-900 rounded-lg p-3 border border-dark-600 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
            <p className="text-gray-400 mb-2 font-sans text-xs font-medium">Diagnose Resultaat:</p>
            <div className="space-y-1">
              {Object.entries(diagResult).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-gray-500 shrink-0">{key}:</span>
                  <span className={`break-all ${
                    key === 'sessionSuccess' && value === true ? 'text-green-400' :
                    key === 'sessionSuccess' && value === false ? 'text-red-400' :
                    key === 'apiReachable' && value === true ? 'text-green-400' :
                    key === 'apiReachable' && value === false ? 'text-red-400' :
                    'text-gray-300'
                  }`}>
                    {typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!hasToken && !showTokenForm && (
        <div className="text-center py-12 text-gray-400">
          <Link2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-300">Geen e-Boekhouden koppeling ingesteld</p>
          <p className="text-xs mt-1.5 max-w-md mx-auto leading-relaxed">
            Koppel je administratie om automatisch relaties en facturen te synchroniseren.
          </p>
          <button
            onClick={() => {
              setTokenInput('');
              setShowTokenForm(true);
            }}
            className="mt-4 flex items-center gap-2 mx-auto bg-gold-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gold-600 transition-colors"
          >
            <Link2 size={16} />
            Koppeling instellen
          </button>
        </div>
      )}

      {hasToken && (
        <>
          {connected && (
            <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-400 uppercase">Factuur Sjabloon</h4>
                <button
                  onClick={handleLoadInvoiceTemplates}
                  disabled={templatesLoading}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
                >
                  {templatesLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Sjablonen ophalen
                </button>
              </div>
              {settings?.eboekhouden_template_id ? (
                <p className="text-sm text-green-400 mb-2">
                  Huidig sjabloon ID: <span className="font-mono">{settings.eboekhouden_template_id}</span>
                </p>
              ) : (
                <p className="text-sm text-yellow-400 mb-2">
                  Geen sjabloon geselecteerd - selecteer een factuursjabloon om te kunnen synchroniseren
                </p>
              )}
              {templatesError && (
                <div className="flex items-center gap-2 p-2 bg-red-900/10 border border-red-800/30 rounded-lg text-sm text-red-400 mb-2">
                  <XCircle size={14} className="shrink-0" />
                  <span>{templatesError}</span>
                </div>
              )}
              {invoiceTemplates.length > 0 && (
                <div className="space-y-1">
                  {invoiceTemplates.map((tpl) => (
                    <div key={tpl.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-dark-700/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-300">{tpl.id}</span>
                        <span className="text-sm text-gray-200">{tpl.name}</span>
                      </div>
                      <button
                        onClick={() => handleSaveTemplateId(tpl.id)}
                        disabled={templateSaving || settings?.eboekhouden_template_id === tpl.id}
                        className={`px-3 py-1 rounded text-xs transition-colors disabled:opacity-50 ${
                          settings?.eboekhouden_template_id === tpl.id
                            ? 'bg-green-900/30 text-green-400 border border-green-800/30'
                            : 'bg-gold-500 text-white hover:bg-gold-600'
                        }`}
                      >
                        {settings?.eboekhouden_template_id === tpl.id ? 'Geselecteerd' : 'Selecteren'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {invoiceTemplates.length === 0 && !templatesLoading && !templatesError && (
                <p className="text-xs text-gray-500">Klik op "Sjablonen ophalen" om beschikbare sjablonen te laden</p>
              )}
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Synchronisatie Overzicht</h4>
            <div className="grid grid-cols-2 gap-3">
              <SyncStatCard
                icon={<Users size={18} />}
                label="Huurders"
                synced={syncStats.tenantsSynced}
                total={syncStats.tenantsTotal}
                connected={connected}
              />
              <SyncStatCard
                icon={<Users size={18} />}
                label="Externe Klanten"
                synced={syncStats.externalSynced}
                total={syncStats.externalTotal}
                connected={connected}
              />
              <SyncStatCard
                icon={<FileText size={18} />}
                label="Facturen"
                synced={syncStats.invoicesSynced}
                total={syncStats.invoicesTotal}
                connected={connected}
              />
              <SyncStatCard
                icon={<FileText size={18} />}
                label="Creditnota's"
                synced={syncStats.creditNotesSynced}
                total={syncStats.creditNotesTotal}
                connected={connected}
              />
              <SyncStatCard
                icon={<ArrowDownRight size={18} />}
                label="Inkoopfacturen"
                synced={syncStats.purchaseInvoicesSynced}
                total={syncStats.purchaseInvoicesTotal}
                connected={connected}
              />
            </div>

            {connected && (syncStats.tenantsTotal - syncStats.tenantsSynced > 0 || syncStats.externalTotal - syncStats.externalSynced > 0) && (
              <div className="mt-3 bg-dark-800 rounded-lg p-4 border border-dark-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-200">Relaties synchroniseren</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {syncStats.tenantsTotal - syncStats.tenantsSynced + syncStats.externalTotal - syncStats.externalSynced} relatie(s) nog niet gesynchroniseerd
                    </p>
                  </div>
                  <button
                    onClick={handleSyncAllRelations}
                    disabled={syncingRelations}
                    className="flex items-center gap-2 px-4 py-2 bg-gold-500 text-white rounded-lg text-sm hover:bg-gold-600 transition-colors disabled:opacity-50"
                  >
                    {syncingRelations ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {syncingRelations ? 'Synchroniseren...' : 'Alles synchroniseren'}
                  </button>
                </div>
                {syncRelationResult && (
                  <div className="mt-3 pt-3 border-t border-dark-700">
                    <div className="flex items-center gap-2 text-sm">
                      {syncRelationResult.failed === 0 ? (
                        <CheckCircle2 size={14} className="text-green-400" />
                      ) : (
                        <AlertTriangle size={14} className="text-yellow-400" />
                      )}
                      <span className="text-gray-200">
                        {syncRelationResult.success} geslaagd{syncRelationResult.failed > 0 && `, ${syncRelationResult.failed} mislukt`}
                      </span>
                    </div>
                    {syncRelationResult.errors.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {syncRelationResult.errors.map((err, i) => (
                          <p key={i} className="text-xs text-red-400">{err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-400 uppercase">Grootboek Mapping</h4>
              <button
                onClick={() => setShowMappingForm(!showMappingForm)}
                className="flex items-center gap-1.5 text-sm text-gold-500 hover:text-gold-400 transition-colors"
              >
                <Plus size={14} />
                Toevoegen
              </button>
            </div>

            {showMappingForm && (
              <div className="bg-dark-800 rounded-lg p-4 border border-dark-700 mb-3">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Lokale Categorie</label>
                    <select
                      value={mappingForm.local_category}
                      onChange={(e) => setMappingForm({ ...mappingForm, local_category: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-900 border border-dark-600 text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                    >
                      <option value="">Selecteer...</option>
                      <option value="default">Standaard</option>
                      <option value="huur_kantoor">Huur - Kantoor</option>
                      <option value="huur_bedrijfsruimte">Huur - Bedrijfsruimte</option>
                      <option value="huur_buitenterrein">Huur - Buitenterrein</option>
                      <option value="diversen">Diversen</option>
                      <option value="vergaderruimte">Vergaderruimte</option>
                      <option value="flexplek">Flexplek</option>
                      <option disabled>--- Inkoop ---</option>
                      <option value="inkoop_default">Inkoop - Standaard</option>
                      <option value="inkoop_onderhoud">Inkoop - Onderhoud</option>
                      <option value="inkoop_kantoorbenodigdheden">Inkoop - Kantoorbenodigdheden</option>
                      <option value="inkoop_energie">Inkoop - Energie</option>
                      <option value="inkoop_water">Inkoop - Water</option>
                      <option value="inkoop_verzekering">Inkoop - Verzekering</option>
                      <option value="inkoop_telecom">Inkoop - Telecom / Internet</option>
                      <option value="inkoop_schoonmaak">Inkoop - Schoonmaak</option>
                      <option value="inkoop_beveiliging">Inkoop - Beveiliging</option>
                      <option value="inkoop_belastingen">Inkoop - Belastingen</option>
                      <option value="inkoop_advies">Inkoop - Advieskosten</option>
                      <option value="inkoop_overig">Inkoop - Overig</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Grootboek Code</label>
                    <input
                      type="text"
                      value={mappingForm.grootboek_code}
                      onChange={(e) => setMappingForm({ ...mappingForm, grootboek_code: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-900 border border-dark-600 text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="Bijv. 8000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Omschrijving</label>
                    <input
                      type="text"
                      value={mappingForm.grootboek_omschrijving}
                      onChange={(e) => setMappingForm({ ...mappingForm, grootboek_omschrijving: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-900 border border-dark-600 text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="Bijv. Omzet verhuur"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">BTW Code</label>
                    <select
                      value={mappingForm.btw_code}
                      onChange={(e) => setMappingForm({ ...mappingForm, btw_code: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-900 border border-dark-600 text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                    >
                      <option value="">Geen</option>
                      <option value="HOOG_VERK_21">21% BTW (verkoop)</option>
                      <option value="LAAG_VERK_9">9% BTW (verkoop)</option>
                      <option value="HOOG_INK_21">21% BTW (inkoop)</option>
                      <option value="LAAG_INK_9">9% BTW (inkoop)</option>
                      <option value="GEEN">0% BTW</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveMapping}
                    disabled={mappingSaving || !mappingForm.local_category || !mappingForm.grootboek_code}
                    className="flex items-center gap-1.5 bg-gold-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gold-600 transition-colors disabled:opacity-50"
                  >
                    {mappingSaving && <Loader2 size={14} className="animate-spin" />}
                    Opslaan
                  </button>
                  <button
                    onClick={() => setShowMappingForm(false)}
                    className="px-3 py-1.5 text-gray-400 hover:text-gray-200 text-sm transition-colors"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            )}

            <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
              {mappings.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-dark-700/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Categorie</th>
                      <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Code</th>
                      <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Omschrijving</th>
                      <th className="text-left px-4 py-2.5 text-gray-400 font-medium">BTW</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m) => (
                      <tr key={m.id} className="border-t border-dark-700 hover:bg-dark-700/30">
                        <td className="px-4 py-2 text-gray-200">{formatCategory(m.local_category)}</td>
                        <td className="px-4 py-2 text-gray-300 font-mono">{m.grootboek_code}</td>
                        <td className="px-4 py-2 text-gray-300">{m.grootboek_omschrijving}</td>
                        <td className="px-4 py-2 text-gray-400">{formatBtwCode(m.btw_code)}</td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => handleDeleteMapping(m.id)}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <Settings2 size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nog geen grootboek mappings ingesteld</p>
                  <p className="text-xs mt-1">Koppel lokale categorieeen aan grootboekrekeningen</p>
                </div>
              )}
            </div>
          </div>

          {connected && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-400 uppercase">Grootboekrekeningen (e-Boekhouden)</h4>
                <button
                  onClick={handleLoadLedger}
                  disabled={ledgerLoading}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
                >
                  {ledgerLoading ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                  Ophalen
                </button>
              </div>
              {showLedger && ledgerAccounts.length > 0 && (
                <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-dark-700/50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Code</th>
                        <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Omschrijving</th>
                        <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Categorie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerAccounts.map((acc) => (
                        <tr key={acc.id} className="border-t border-dark-700 hover:bg-dark-700/30">
                          <td className="px-4 py-1.5 text-gray-200 font-mono">{acc.code}</td>
                          <td className="px-4 py-1.5 text-gray-300">{acc.description}</td>
                          <td className="px-4 py-1.5 text-gray-400">{acc.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {showLedger && ledgerError && (
                <div className="flex items-center gap-2 p-3 bg-red-900/10 border border-red-800/30 rounded-lg text-sm text-red-400">
                  <XCircle size={16} className="shrink-0" />
                  <span>{ledgerError}</span>
                </div>
              )}
              {showLedger && !ledgerError && ledgerAccounts.length === 0 && (
                <p className="text-sm text-gray-500">Geen grootboekrekeningen gevonden</p>
              )}
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Recente Synchronisaties</h4>
            <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
              {syncLogs.length > 0 ? (
                <div className="max-h-72 overflow-y-auto">
                  {syncLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 border-b border-dark-700 last:border-b-0 hover:bg-dark-700/30">
                      <div className="mt-0.5">
                        {log.status === 'success' ? (
                          <ArrowUpRight size={16} className="text-green-400" />
                        ) : (
                          <AlertTriangle size={16} className="text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-200 font-medium">
                            {formatEntityType(log.entity_type)}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            log.status === 'success'
                              ? 'bg-green-900/30 text-green-400'
                              : 'bg-red-900/30 text-red-400'
                          }`}>
                            {log.status === 'success' ? 'Geslaagd' : 'Fout'}
                          </span>
                          <span className="text-xs text-gray-500 capitalize">{log.action}</span>
                        </div>
                        {log.error_message && (
                          <p className="text-xs text-red-400/80 mt-0.5 truncate">{log.error_message}</p>
                        )}
                        {log.eboekhouden_id && (
                          <p className="text-xs text-gray-500 mt-0.5">e-Boekhouden ID: {log.eboekhouden_id}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTimeAgo(log.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <Activity size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nog geen synchronisaties uitgevoerd</p>
                  <p className="text-xs mt-1">
                    {connected
                      ? 'Synchroniseer facturen via het factuuroverzicht'
                      : 'Verbind eerst met e-Boekhouden om te synchroniseren'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Hoe werkt de synchronisatie?</h4>
            <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
              <div className="flex items-start gap-2">
                <ArrowUpRight size={12} className="mt-0.5 text-gold-500 shrink-0" />
                <p>Bij het synchroniseren van een factuur wordt automatisch de huurder/klant als relatie aangemaakt in e-Boekhouden (als deze nog niet bestaat).</p>
              </div>
              <div className="flex items-start gap-2">
                <ArrowDownRight size={12} className="mt-0.5 text-gold-500 shrink-0" />
                <p>Inkoopfacturen worden als mutatie geboekt. De leverancier wordt automatisch als relatie aangemaakt.</p>
              </div>
              <div className="flex items-start gap-2">
                <BookOpen size={12} className="mt-0.5 text-gold-500 shrink-0" />
                <p>Factuurregels worden gekoppeld aan de ingestelde grootboekrekeningen via de mapping hierboven.</p>
              </div>
              <div className="flex items-start gap-2">
                <Clock size={12} className="mt-0.5 text-gold-500 shrink-0" />
                <p>Alle synchronisatie-acties worden gelogd, zodat je altijd kunt zien wat er is verstuurd.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SyncStatCard({ icon, label, synced, total, connected }: {
  icon: React.ReactNode;
  label: string;
  synced: number;
  total: number;
  connected: boolean;
}) {
  const percentage = total > 0 ? Math.round((synced / total) * 100) : 0;

  return (
    <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-sm font-medium text-gray-200">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold text-gray-100">{synced}</span>
          <span className="text-sm text-gray-500 ml-1">/ {total}</span>
        </div>
        {total > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            !connected ? 'bg-gray-800 text-gray-500'
              : percentage === 100 ? 'bg-green-900/30 text-green-400'
              : percentage > 0 ? 'bg-yellow-900/30 text-yellow-400'
              : 'bg-dark-700 text-gray-500'
          }`}>
            {percentage}%
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="mt-2 h-1.5 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              !connected ? 'bg-gray-600'
                : percentage === 100 ? 'bg-green-500'
                : percentage > 0 ? 'bg-yellow-500'
                : 'bg-gray-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    'default': 'Standaard',
    'huur_kantoor': 'Huur - Kantoor',
    'huur_bedrijfsruimte': 'Huur - Bedrijfsruimte',
    'huur_buitenterrein': 'Huur - Buitenterrein',
    'diversen': 'Diversen',
    'vergaderruimte': 'Vergaderruimte',
    'flexplek': 'Flexplek',
    'inkoop_default': 'Inkoop - Standaard',
    'inkoop_onderhoud': 'Inkoop - Onderhoud',
    'inkoop_kantoorbenodigdheden': 'Inkoop - Kantoorbenodigdheden',
    'inkoop_energie': 'Inkoop - Energie',
    'inkoop_water': 'Inkoop - Water',
    'inkoop_verzekering': 'Inkoop - Verzekering',
    'inkoop_telecom': 'Inkoop - Telecom / Internet',
    'inkoop_schoonmaak': 'Inkoop - Schoonmaak',
    'inkoop_beveiliging': 'Inkoop - Beveiliging',
    'inkoop_belastingen': 'Inkoop - Belastingen',
    'inkoop_advies': 'Inkoop - Advieskosten',
    'inkoop_overig': 'Inkoop - Overig',
  };
  return map[cat] || cat;
}

function formatBtwCode(code: string | null): string {
  if (!code) return '-';
  const map: Record<string, string> = {
    'HOOG_VERK_21': '21% (verkoop)',
    'LAAG_VERK_9': '9% (verkoop)',
    'HOOG_INK_21': '21% (inkoop)',
    'LAAG_INK_9': '9% (inkoop)',
    'GEEN': '0%',
  };
  return map[code] || code;
}

function formatEntityType(type: string): string {
  const map: Record<string, string> = {
    'relation': 'Relatie',
    'invoice': 'Factuur',
    'credit_note': 'Creditnota',
    'purchase_invoice': 'Inkoopfactuur',
    'supplier_relation': 'Leverancier',
  };
  return map[type] || type;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Zojuist';
  if (diffMin < 60) return `${diffMin}m geleden`;
  if (diffHour < 24) return `${diffHour}u geleden`;
  if (diffDay < 7) return `${diffDay}d geleden`;

  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}
