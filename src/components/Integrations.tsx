import { useState, useEffect } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { Plug, Database, Eye, EyeOff, Link2, CheckCircle2, XCircle, Loader2, Unlink, Mail, Send, Cloud, Zap } from 'lucide-react';
import { testConnection } from '../lib/eboekhouden';

type ConfirmModal = {
  show: boolean;
  enabling: boolean;
};

export function Integrations() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [savingGraph, setSavingGraph] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showGraphSecret, setShowGraphSecret] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testSmtpLoading, setTestSmtpLoading] = useState(false);
  const [testGraphLoading, setTestGraphLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testSmtpResult, setTestSmtpResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testGraphResult, setTestGraphResult] = useState<{ success: boolean; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({ show: false, enabling: false });
  const [applyingChange, setApplyingChange] = useState(false);

  const [ebEnabled, setEbEnabled] = useState(false);
  const [ebToken, setEbToken] = useState('');

  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');

  const [graphEnabled, setGraphEnabled] = useState(false);
  const [graphTenantId, setGraphTenantId] = useState('');
  const [graphClientId, setGraphClientId] = useState('');
  const [graphClientSecret, setGraphClientSecret] = useState('');
  const [graphFromEmail, setGraphFromEmail] = useState('');
  const [graphFromName, setGraphFromName] = useState('');

  const [resendEnabled, setResendEnabled] = useState(false);
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState('');
  const [resendFromName, setResendFromName] = useState('');
  const [showResendKey, setShowResendKey] = useState(false);
  const [savingResend, setSavingResend] = useState(false);
  const [testResendLoading, setTestResendLoading] = useState(false);
  const [testResendResult, setTestResendResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setSettings(data);
      setEbEnabled(data.eboekhouden_enabled ?? false);
      setEbToken(data.eboekhouden_api_token ?? '');
      setSmtpEnabled(data.smtp_enabled ?? false);
      setSmtpHost(data.smtp_host ?? '');
      setSmtpPort(String(data.smtp_port ?? 587));
      setSmtpUser(data.smtp_user ?? '');
      setSmtpPassword(data.smtp_password ?? '');
      setSmtpFromName(data.smtp_from_name ?? '');
      setSmtpFromEmail(data.smtp_from_email ?? '');
      setGraphEnabled(data.graph_enabled ?? false);
      setGraphTenantId(data.graph_tenant_id ?? '');
      setGraphClientId(data.graph_client_id ?? '');
      setGraphClientSecret(data.graph_client_secret ?? '');
      setGraphFromEmail(data.graph_from_email ?? '');
      setGraphFromName(data.graph_from_name ?? '');
      setResendEnabled(data.resend_enabled ?? false);
      setResendApiKey(data.resend_api_key ?? '');
      setResendFromEmail(data.resend_from_email ?? '');
      setResendFromName(data.resend_from_name ?? '');
    }
    setLoading(false);
  };

  const handleToggleClick = () => {
    setConfirmModal({ show: true, enabling: !ebEnabled });
  };

  const handleConfirmToggle = async () => {
    if (!settings) return;
    setConfirmModal({ show: false, enabling: false });
    setApplyingChange(true);

    const newEnabled = !ebEnabled;

    await supabase
      .from('company_settings')
      .update({
        eboekhouden_enabled: newEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id);

    await new Promise(resolve => setTimeout(resolve, 800));

    window.dispatchEvent(new CustomEvent('eboekhouden-enabled-changed', { detail: { enabled: newEnabled } }));

    document.documentElement.style.backgroundColor = '#0a0a0f';
    document.body.style.backgroundColor = '#0a0a0f';

    window.location.reload();
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('company_settings')
      .update({
        eboekhouden_api_token: ebToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
      .select()
      .single();

    if (!error && data) {
      setSettings(data);
    }
    setSaving(false);
  };

  const handleSaveSmtp = async () => {
    if (!settings) return;
    setSavingSmtp(true);
    const { data, error } = await supabase
      .from('company_settings')
      .update({
        smtp_enabled: smtpEnabled,
        smtp_host: smtpHost,
        smtp_port: parseInt(smtpPort) || 587,
        smtp_user: smtpUser,
        smtp_password: smtpPassword,
        smtp_from_name: smtpFromName,
        smtp_from_email: smtpFromEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
      .select()
      .single();

    if (!error && data) {
      setSettings(data);
    }
    setSavingSmtp(false);
  };

  const handleSaveGraph = async () => {
    if (!settings) return;
    setSavingGraph(true);
    const { data, error } = await supabase
      .from('company_settings')
      .update({
        graph_enabled: graphEnabled,
        graph_tenant_id: graphTenantId,
        graph_client_id: graphClientId,
        graph_client_secret: graphClientSecret,
        graph_from_email: graphFromEmail,
        graph_from_name: graphFromName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
      .select()
      .single();

    if (!error && data) {
      setSettings(data);
    }
    setSavingGraph(false);
  };

  const handleTestConnection = async () => {
    if (!ebToken) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await testConnection(ebToken);
      if (result.success) {
        setTestResult({ success: true, message: 'Verbinding succesvol!' });
        if (settings) {
          await supabase
            .from('company_settings')
            .update({ eboekhouden_connected: true, updated_at: new Date().toISOString() })
            .eq('id', settings.id);
          setSettings({ ...settings, eboekhouden_connected: true });
        }
      } else {
        setTestResult({ success: false, message: result.error || 'Verbinding mislukt. Controleer je API token.' });
        if (settings) {
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

  const handleTestSmtp = async () => {
    if (!smtpHost || !smtpUser || !smtpPassword) return;
    setTestSmtpLoading(true);
    setTestSmtpResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qlvndvpxhqmjljjpehkn.supabase.co';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdm5kdnB4aHFtamxqanBlaGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5MjI1MzQsImV4cCI6MjA3NjQ5ODUzNH0.q1Kel_GCQqUx2J5Nd9WFOVz7okodFPcoAJkKL6YVkUk';

      const response = await fetch(`${supabaseUrl}/functions/v1/smtp-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'test',
          smtp: {
            host: smtpHost,
            port: parseInt(smtpPort) || 587,
            user: smtpUser,
            password: smtpPassword,
            from_name: smtpFromName || smtpUser,
            from_email: smtpFromEmail || smtpUser,
          },
          to: smtpFromEmail || smtpUser,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTestSmtpResult({ success: true, message: 'Verbinding succesvol! Test e-mail verzonden.' });
        if (settings) {
          await supabase
            .from('company_settings')
            .update({ smtp_connected: true, updated_at: new Date().toISOString() })
            .eq('id', settings.id);
          setSettings({ ...settings, smtp_connected: true });
        }
      } else {
        setTestSmtpResult({ success: false, message: result.error || 'Verbinding mislukt. Controleer de SMTP instellingen.' });
        if (settings) {
          await supabase
            .from('company_settings')
            .update({ smtp_connected: false, updated_at: new Date().toISOString() })
            .eq('id', settings.id);
          setSettings({ ...settings, smtp_connected: false });
        }
      }
    } catch {
      setTestSmtpResult({ success: false, message: 'Fout bij het testen van de SMTP verbinding' });
    } finally {
      setTestSmtpLoading(false);
    }
  };

  const handleTestGraph = async () => {
    if (!graphTenantId || !graphClientId || !graphClientSecret || !graphFromEmail) return;
    setTestGraphLoading(true);
    setTestGraphResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qlvndvpxhqmjljjpehkn.supabase.co';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdm5kdnB4aHFtamxqanBlaGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5MjI1MzQsImV4cCI6MjA3NjQ5ODUzNH0.q1Kel_GCQqUx2J5Nd9WFOVz7okodFPcoAJkKL6YVkUk';

      const response = await fetch(`${supabaseUrl}/functions/v1/graph-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'test',
          graph: {
            tenant_id: graphTenantId,
            client_id: graphClientId,
            client_secret: graphClientSecret,
            from_email: graphFromEmail,
            from_name: graphFromName,
          },
          to: graphFromEmail,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTestGraphResult({ success: true, message: 'Verbinding succesvol! Test e-mail verzonden.' });
        if (settings) {
          await supabase
            .from('company_settings')
            .update({ graph_connected: true, updated_at: new Date().toISOString() })
            .eq('id', settings.id);
          setSettings({ ...settings, graph_connected: true });
        }
      } else {
        setTestGraphResult({ success: false, message: result.error || 'Verbinding mislukt. Controleer de Graph API instellingen.' });
        if (settings) {
          await supabase
            .from('company_settings')
            .update({ graph_connected: false, updated_at: new Date().toISOString() })
            .eq('id', settings.id);
          setSettings({ ...settings, graph_connected: false });
        }
      }
    } catch {
      setTestGraphResult({ success: false, message: 'Fout bij het testen van de Graph API verbinding' });
    } finally {
      setTestGraphLoading(false);
    }
  };

  const handleSaveResend = async () => {
    if (!settings) return;
    setSavingResend(true);
    const { data, error } = await supabase
      .from('company_settings')
      .update({
        resend_enabled: resendEnabled,
        resend_api_key: resendApiKey,
        resend_from_email: resendFromEmail,
        resend_from_name: resendFromName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
      .select()
      .single();

    if (!error && data) {
      setSettings(data);
    }
    setSavingResend(false);
  };

  const handleTestResend = async () => {
    if (!resendApiKey || !resendFromEmail) return;
    setTestResendLoading(true);
    setTestResendResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qlvndvpxhqmjljjpehkn.supabase.co';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdm5kdnB4aHFtamxqanBlaGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5MjI1MzQsImV4cCI6MjA3NjQ5ODUzNH0.q1Kel_GCQqUx2J5Nd9WFOVz7okodFPcoAJkKL6YVkUk';

      const response = await fetch(`${supabaseUrl}/functions/v1/resend-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'test',
          resend: {
            api_key: resendApiKey,
            from_email: resendFromEmail,
            from_name: resendFromName,
          },
          to: resendFromEmail,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTestResendResult({ success: true, message: 'Verbinding succesvol! Test e-mail verzonden.' });
        if (settings) {
          await supabase
            .from('company_settings')
            .update({ resend_connected: true, updated_at: new Date().toISOString() })
            .eq('id', settings.id);
          setSettings({ ...settings, resend_connected: true });
        }
      } else {
        setTestResendResult({ success: false, message: result.error || 'Verbinding mislukt. Controleer de Resend instellingen.' });
        if (settings) {
          await supabase
            .from('company_settings')
            .update({ resend_connected: false, updated_at: new Date().toISOString() })
            .eq('id', settings.id);
          setSettings({ ...settings, resend_connected: false });
        }
      }
    } catch {
      setTestResendResult({ success: false, message: 'Fout bij het testen van de Resend verbinding' });
    } finally {
      setTestResendLoading(false);
    }
  };

  const hasTokenChanges = settings
    ? ebToken !== (settings.eboekhouden_api_token ?? '')
    : false;

  const hasSmtpChanges = settings
    ? smtpEnabled !== (settings.smtp_enabled ?? false) ||
      smtpHost !== (settings.smtp_host ?? '') ||
      smtpPort !== String(settings.smtp_port ?? 587) ||
      smtpUser !== (settings.smtp_user ?? '') ||
      smtpPassword !== (settings.smtp_password ?? '') ||
      smtpFromName !== (settings.smtp_from_name ?? '') ||
      smtpFromEmail !== (settings.smtp_from_email ?? '')
    : false;

  const hasGraphChanges = settings
    ? graphEnabled !== (settings.graph_enabled ?? false) ||
      graphTenantId !== (settings.graph_tenant_id ?? '') ||
      graphClientId !== (settings.graph_client_id ?? '') ||
      graphClientSecret !== (settings.graph_client_secret ?? '') ||
      graphFromEmail !== (settings.graph_from_email ?? '') ||
      graphFromName !== (settings.graph_from_name ?? '')
    : false;

  const hasResendChanges = settings
    ? resendEnabled !== (settings.resend_enabled ?? false) ||
      resendApiKey !== (settings.resend_api_key ?? '') ||
      resendFromEmail !== (settings.resend_from_email ?? '') ||
      resendFromName !== (settings.resend_from_name ?? '')
    : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-gold-500" size={28} />
      </div>
    );
  }

  return (
    <>
      {applyingChange && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-950/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-dark-700" />
              <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-t-teal-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-gray-100 font-semibold text-lg">Koppeling bijwerken...</p>
              <p className="text-gray-400 text-sm mt-1">De app wordt opnieuw geladen</p>
            </div>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                confirmModal.enabling ? 'bg-teal-500/10' : 'bg-red-500/10'
              }`}>
                {confirmModal.enabling
                  ? <Link2 size={22} className="text-teal-400" />
                  : <Unlink size={22} className="text-red-400" />
                }
              </div>
              <h3 className="text-gray-100 font-semibold text-lg mb-2">
                {confirmModal.enabling ? 'Koppeling activeren' : 'Koppeling verbreken'}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {confirmModal.enabling
                  ? 'De e-Boekhouden koppeling wordt geactiveerd. Het tabblad "e-Boekhouden" verschijnt in de navigatie. De app wordt hierna opnieuw geladen.'
                  : 'De e-Boekhouden koppeling wordt verbroken. Het tabblad "e-Boekhouden" verdwijnt uit de navigatie. De app wordt hierna opnieuw geladen.'
                }
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setConfirmModal({ show: false, enabling: false })}
                className="flex-1 px-4 py-2.5 rounded-lg border border-dark-600 text-gray-300 hover:bg-dark-800 transition-colors text-sm font-medium"
              >
                Annuleren
              </button>
              <button
                onClick={handleConfirmToggle}
                className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors ${
                  confirmModal.enabling
                    ? 'bg-teal-600 hover:bg-teal-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {confirmModal.enabling ? 'Activeren' : 'Verbreken'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* e-Boekhouden */}
        <div className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-dark-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <Database size={18} className="text-teal-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-100">e-Boekhouden</h3>
              <p className="text-xs text-gray-400 mt-0.5">Online boekhoudpakket koppeling</p>
            </div>
            <div className="flex items-center gap-3">
              {ebEnabled && (
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                  settings?.eboekhouden_connected
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${settings?.eboekhouden_connected ? 'bg-green-400' : 'bg-amber-400'}`} />
                  {settings?.eboekhouden_connected ? 'Verbonden' : 'Niet verbonden'}
                </span>
              )}
              <button
                onClick={handleToggleClick}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  ebEnabled ? 'bg-teal-600' : 'bg-dark-600'
                }`}
                title={ebEnabled ? 'Koppeling verbreken' : 'Koppeling activeren'}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  ebEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${ebEnabled ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-400">
                Voer je API token in om de koppeling met e-Boekhouden te activeren. Het token is te vinden via
                <span className="text-gray-300"> Beheer &gt; Inrichting &gt; Instellingen &gt; Koppelingen &gt; API/SOAP</span>.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5">API Token</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={ebToken}
                    onChange={(e) => setEbToken(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                    placeholder="Plak hier je e-Boekhouden API token"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testLoading || !ebToken}
                  className="flex items-center gap-2 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors border border-dark-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {testLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Link2 size={15} />
                  )}
                  Test Verbinding
                </button>
                {testResult && (
                  <div className={`flex items-center gap-1.5 text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.success ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!ebEnabled && (
            <div className="px-6 py-4 text-sm text-gray-500">
              Schakel de koppeling in om de e-Boekhouden integratie te configureren en te gebruiken.
            </div>
          )}
        </div>

        {hasTokenChanges && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
              {saving ? 'Opslaan...' : 'Token opslaan'}
            </button>
          </div>
        )}

        {/* SMTP E-mail */}
        <div className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-dark-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Mail size={18} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-100">SMTP E-mail</h3>
              <p className="text-xs text-gray-400 mt-0.5">E-mails verzenden via eigen mailserver</p>
            </div>
            <div className="flex items-center gap-3">
              {smtpEnabled && (
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                  settings?.smtp_connected
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${settings?.smtp_connected ? 'bg-green-400' : 'bg-amber-400'}`} />
                  {settings?.smtp_connected ? 'Verbonden' : 'Niet getest'}
                </span>
              )}
              <button
                onClick={() => setSmtpEnabled(!smtpEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  smtpEnabled ? 'bg-blue-600' : 'bg-dark-600'
                }`}
                title={smtpEnabled ? 'SMTP uitschakelen' : 'SMTP inschakelen'}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  smtpEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${smtpEnabled ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-400">
                Configureer je SMTP server om facturen en e-mails te verzenden vanuit je eigen mailaccount.
                Voor Microsoft 365 gebruik je <span className="text-gray-300 font-mono">smtp.office365.com</span> op poort <span className="text-gray-300 font-mono">587</span>.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1.5">SMTP Server</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="smtp.office365.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1.5">Poort</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1.5">Gebruikersnaam / E-mailadres</label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="facturen@bedrijf.nl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1.5">Wachtwoord</label>
                  <div className="relative">
                    <input
                      type={showSmtpPassword ? 'text' : 'password'}
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Wachtwoord of app-wachtwoord"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showSmtpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <p className="text-xs text-gray-500 mb-3 uppercase font-semibold tracking-wide">Afzender</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1.5">Weergavenaam</label>
                    <input
                      type="text"
                      value={smtpFromName}
                      onChange={(e) => setSmtpFromName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="HAL5 Factuuradministratie"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1.5">Van e-mailadres</label>
                    <input
                      type="email"
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="facturen@bedrijf.nl"
                    />
                    <p className="text-xs text-gray-500 mt-1">Laat leeg om gebruikersnaam te gebruiken</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestSmtp}
                    disabled={testSmtpLoading || !smtpHost || !smtpUser || !smtpPassword}
                    className="flex items-center gap-2 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors border border-dark-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {testSmtpLoading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    Test Verbinding
                  </button>
                  {testSmtpResult && testSmtpResult.success && (
                    <div className="flex items-center gap-1.5 text-sm text-green-400">
                      <CheckCircle2 size={15} />
                      {testSmtpResult.message}
                    </div>
                  )}
                </div>

                {testSmtpResult && !testSmtpResult.success && (
                  <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <XCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-300 font-medium">Verbinding mislukt</p>
                    </div>
                    {testSmtpResult.message.includes('SmtpClientAuthentication') || testSmtpResult.message.includes('5.7.139') ? (
                      <div className="ml-5 space-y-2">
                        <p className="text-sm text-red-200">
                          SMTP verificatie is uitgeschakeld voor dit Microsoft/Outlook account.
                        </p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          <span className="font-semibold text-gray-300">Oplossing voor Outlook.com / Hotmail:</span><br />
                          Ga naar <span className="font-mono text-gray-200">account.microsoft.com</span> &gt; Beveiliging &gt; Geavanceerde beveiligingsopties en schakel "Authenticatie voor andere e-mail-apps" in.
                        </p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          <span className="font-semibold text-gray-300">Oplossing voor Microsoft 365 (zakelijk):</span><br />
                          De beheerder moet via het Microsoft 365 Admin Center SMTP AUTH inschakelen voor dit postvak: <span className="font-mono text-gray-200">admin.microsoft.com</span> &gt; Actieve gebruikers &gt; [gebruiker] &gt; E-mail &gt; E-mailapps &gt; Geverifieerde SMTP.
                        </p>
                        <p className="text-xs text-amber-400/80 leading-relaxed border-t border-dark-700 pt-2">
                          Overweeg de <span className="font-semibold">Microsoft Graph API</span> koppeling hieronder als alternatief. Die werkt zonder SMTP AUTH en is de moderne Microsoft-aanbevolen methode.
                        </p>
                      </div>
                    ) : testSmtpResult.message.includes('535') || testSmtpResult.message.includes('Authentication') ? (
                      <div className="ml-5">
                        <p className="text-sm text-red-200">Authenticatie mislukt. Controleer je gebruikersnaam en wachtwoord.</p>
                        <p className="text-xs text-gray-400 mt-1">Als je 2FA gebruikt, maak dan een app-wachtwoord aan in de accountinstellingen.</p>
                      </div>
                    ) : (
                      <div className="ml-5">
                        <p className="text-xs text-gray-400 break-words">{testSmtpResult.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!smtpEnabled && (
            <div className="px-6 py-4 text-sm text-gray-500">
              Schakel SMTP in om e-mails te versturen via je eigen mailserver.
            </div>
          )}
        </div>

        {hasSmtpChanges && (
          <div className="flex justify-end">
            <button
              onClick={handleSaveSmtp}
              disabled={savingSmtp}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {savingSmtp ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {savingSmtp ? 'Opslaan...' : 'SMTP instellingen opslaan'}
            </button>
          </div>
        )}

        {/* Microsoft Graph API */}
        <div className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-dark-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Cloud size={18} className="text-sky-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-100">Microsoft Graph API</h3>
              <p className="text-xs text-gray-400 mt-0.5">E-mails verzenden via Microsoft 365 zonder SMTP</p>
            </div>
            <div className="flex items-center gap-3">
              {graphEnabled && (
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                  settings?.graph_connected
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${settings?.graph_connected ? 'bg-green-400' : 'bg-amber-400'}`} />
                  {settings?.graph_connected ? 'Verbonden' : 'Niet getest'}
                </span>
              )}
              <button
                onClick={() => setGraphEnabled(!graphEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  graphEnabled ? 'bg-sky-600' : 'bg-dark-600'
                }`}
                title={graphEnabled ? 'Graph API uitschakelen' : 'Graph API inschakelen'}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  graphEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${graphEnabled ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 p-4 space-y-1.5">
                <p className="text-sm text-sky-300 font-medium">Vereiste voorbereiding in Azure</p>
                <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Ga naar <span className="font-mono text-gray-300">portal.azure.com</span> &gt; Azure Active Directory &gt; App-registraties</li>
                  <li>Maak een nieuwe registratie aan en noteer de <span className="font-semibold text-gray-300">Directory (tenant) ID</span> en <span className="font-semibold text-gray-300">Application (client) ID</span></li>
                  <li>Ga naar Certificaten &amp; geheimen &gt; Nieuw clientgeheim en kopieer de waarde</li>
                  <li>Ga naar API-machtigingen &gt; Toevoegen &gt; Microsoft Graph &gt; Toepassingsmachtigingen &gt; <span className="font-mono text-gray-300">Mail.Send</span> &gt; Beheerderstoestemming verlenen</li>
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1.5">Tenant ID <span className="text-gray-500 font-normal">(Directory ID)</span></label>
                  <input
                    type="text"
                    value={graphTenantId}
                    onChange={(e) => setGraphTenantId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1.5">Client ID <span className="text-gray-500 font-normal">(Application ID)</span></label>
                  <input
                    type="text"
                    value={graphClientId}
                    onChange={(e) => setGraphClientId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5">Client Secret</label>
                <div className="relative">
                  <input
                    type={showGraphSecret ? 'text' : 'password'}
                    value={graphClientSecret}
                    onChange={(e) => setGraphClientSecret(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm"
                    placeholder="Clientgeheim waarde"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGraphSecret(!showGraphSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showGraphSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <p className="text-xs text-gray-500 mb-3 uppercase font-semibold tracking-wide">Afzender</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1.5">Van e-mailadres <span className="text-red-400">*</span></label>
                    <input
                      type="email"
                      value={graphFromEmail}
                      onChange={(e) => setGraphFromEmail(e.target.value)}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                      placeholder="facturen@bedrijf.nl"
                    />
                    <p className="text-xs text-gray-500 mt-1">Moet een geldig Microsoft 365 postvak zijn</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1.5">Weergavenaam</label>
                    <input
                      type="text"
                      value={graphFromName}
                      onChange={(e) => setGraphFromName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                      placeholder="HAL5 Factuuradministratie"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestGraph}
                    disabled={testGraphLoading || !graphTenantId || !graphClientId || !graphClientSecret || !graphFromEmail}
                    className="flex items-center gap-2 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors border border-dark-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {testGraphLoading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    Test Verbinding
                  </button>
                  {testGraphResult && testGraphResult.success && (
                    <div className="flex items-center gap-1.5 text-sm text-green-400">
                      <CheckCircle2 size={15} />
                      {testGraphResult.message}
                    </div>
                  )}
                </div>

                {testGraphResult && !testGraphResult.success && (
                  <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <XCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-300 font-medium">Verbinding mislukt</p>
                    </div>
                    {testGraphResult.message.includes('AADSTS') || testGraphResult.message.includes('tenant') || testGraphResult.message.includes('client') ? (
                      <div className="ml-5 space-y-1">
                        <p className="text-sm text-red-200">Azure App configuratie fout. Controleer Tenant ID en Client ID.</p>
                        <p className="text-xs text-gray-400">{testGraphResult.message}</p>
                      </div>
                    ) : testGraphResult.message.includes('Mail.Send') || testGraphResult.message.includes('Authorization') || testGraphResult.message.includes('forbidden') ? (
                      <div className="ml-5 space-y-1">
                        <p className="text-sm text-red-200">Onvoldoende machtigingen. Controleer of Mail.Send is toegevoegd en beheerderstoestemming is verleend.</p>
                        <p className="text-xs text-gray-400">{testGraphResult.message}</p>
                      </div>
                    ) : (
                      <div className="ml-5">
                        <p className="text-xs text-gray-400 break-words">{testGraphResult.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!graphEnabled && (
            <div className="px-6 py-4 text-sm text-gray-500">
              Schakel Microsoft Graph API in als alternatief voor SMTP — werkt zonder SMTP AUTH vereisten.
            </div>
          )}
        </div>

        {hasGraphChanges && (
          <div className="flex justify-end">
            <button
              onClick={handleSaveGraph}
              disabled={savingGraph}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {savingGraph ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
              {savingGraph ? 'Opslaan...' : 'Graph API instellingen opslaan'}
            </button>
          </div>
        )}

        {/* Resend */}
        <div className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-dark-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Zap size={18} className="text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-100">Resend</h3>
              <p className="text-xs text-gray-400 mt-0.5">E-mails verzenden via Resend.com API</p>
            </div>
            <div className="flex items-center gap-3">
              {resendEnabled && (
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                  settings?.resend_connected
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${settings?.resend_connected ? 'bg-green-400' : 'bg-amber-400'}`} />
                  {settings?.resend_connected ? 'Verbonden' : 'Niet getest'}
                </span>
              )}
              <button
                onClick={() => setResendEnabled(!resendEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  resendEnabled ? 'bg-orange-600' : 'bg-dark-600'
                }`}
                title={resendEnabled ? 'Resend uitschakelen' : 'Resend inschakelen'}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  resendEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${resendEnabled ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-4 space-y-1.5">
                <p className="text-sm text-orange-300 font-medium">Vereiste voorbereiding in Resend</p>
                <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Maak een account aan op <span className="font-mono text-gray-300">resend.com</span> en verifieer je domein</li>
                  <li>Ga naar <span className="font-mono text-gray-300">resend.com/api-keys</span> en maak een nieuwe API key aan</li>
                  <li>Gebruik een e-mailadres van je geverifieerde domein als afzender</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5">API Key <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type={showResendKey ? 'text' : 'password'}
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
                    placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResendKey(!showResendKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showResendKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4">
                <p className="text-xs text-gray-500 mb-3 uppercase font-semibold tracking-wide">Afzender</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1.5">Van e-mailadres <span className="text-red-400">*</span></label>
                    <input
                      type="email"
                      value={resendFromEmail}
                      onChange={(e) => setResendFromEmail(e.target.value)}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                      placeholder="facturen@bedrijf.nl"
                    />
                    <p className="text-xs text-gray-500 mt-1">Moet van een geverifieerd domein zijn</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1.5">Weergavenaam</label>
                    <input
                      type="text"
                      value={resendFromName}
                      onChange={(e) => setResendFromName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                      placeholder="HAL5 Factuuradministratie"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestResend}
                    disabled={testResendLoading || !resendApiKey || !resendFromEmail}
                    className="flex items-center gap-2 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors border border-dark-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {testResendLoading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    Test Verbinding
                  </button>
                  {testResendResult && testResendResult.success && (
                    <div className="flex items-center gap-1.5 text-sm text-green-400">
                      <CheckCircle2 size={15} />
                      {testResendResult.message}
                    </div>
                  )}
                </div>

                {testResendResult && !testResendResult.success && (
                  <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <XCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-300 font-medium">Verbinding mislukt</p>
                    </div>
                    {testResendResult.message.includes('domain') || testResendResult.message.includes('sender') ? (
                      <div className="ml-5 space-y-1">
                        <p className="text-sm text-red-200">Afzenderdomein niet geverifieerd. Controleer je domeinverificatie in Resend.</p>
                        <p className="text-xs text-gray-400">{testResendResult.message}</p>
                      </div>
                    ) : testResendResult.message.includes('API key') || testResendResult.message.includes('Unauthorized') || testResendResult.message.includes('401') ? (
                      <div className="ml-5">
                        <p className="text-sm text-red-200">API key ongeldig. Controleer de key op resend.com/api-keys.</p>
                      </div>
                    ) : (
                      <div className="ml-5">
                        <p className="text-xs text-gray-400 break-words">{testResendResult.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!resendEnabled && (
            <div className="px-6 py-4 text-sm text-gray-500">
              Schakel Resend in om e-mails te verzenden via de Resend.com API — eenvoudig en betrouwbaar zonder eigen mailserver.
            </div>
          )}
        </div>

        {hasResendChanges && (
          <div className="flex justify-end">
            <button
              onClick={handleSaveResend}
              disabled={savingResend}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {savingResend ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {savingResend ? 'Opslaan...' : 'Resend instellingen opslaan'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
