import { useState, useEffect } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { Plug, Database, Eye, EyeOff, Link2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { testConnection } from '../lib/eboekhouden';
import { EBoekhoudenDashboard } from './EBoekhoudenDashboard';

export function Integrations() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [ebEnabled, setEbEnabled] = useState(false);
  const [ebToken, setEbToken] = useState('');

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
      setEbEnabled(data.eboekhouden_enabled || data.eboekhouden_connected || false);
      setEbToken(data.eboekhouden_api_token ?? '');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('company_settings')
      .update({
        eboekhouden_enabled: ebEnabled,
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

  const hasChanges = settings
    ? ebEnabled !== settings.eboekhouden_enabled || ebToken !== (settings.eboekhouden_api_token ?? '')
    : false;

  const showDashboard = settings?.eboekhouden_connected && ebToken === (settings?.eboekhouden_api_token ?? '') && !hasChanges;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-gold-500" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            {settings?.eboekhouden_enabled && (
              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                settings.eboekhouden_connected
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${settings.eboekhouden_connected ? 'bg-green-400' : 'bg-amber-400'}`} />
                {settings.eboekhouden_connected ? 'Verbonden' : 'Niet verbonden'}
              </span>
            )}
            <button
              onClick={() => setEbEnabled(!ebEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                ebEnabled ? 'bg-teal-600' : 'bg-dark-600'
              }`}
              title={ebEnabled ? 'Koppeling deactiveren' : 'Koppeling activeren'}
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

      {hasChanges && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
            {saving ? 'Opslaan...' : 'Wijzigingen opslaan'}
          </button>
        </div>
      )}

      {showDashboard && (
        <EBoekhoudenDashboard />
      )}
    </div>
  );
}
