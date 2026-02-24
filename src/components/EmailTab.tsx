import { useState, useEffect } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { isEmailConfigured } from '../utils/emailSender';
import { EmailCompose } from './EmailCompose';
import { EmailSentItems } from './EmailSentItems';
import { Mail, Send, Inbox, Loader2, ExternalLink, AlertTriangle, ArrowRight, CheckCircle2, User, Paperclip, Search, Clock } from 'lucide-react';

type SubTab = 'compose' | 'sent';

type Props = {
  onOpenInSplitscreen?: () => void;
  onNavigateToIntegrations?: () => void;
};

function getEnabledMethod(settings: CompanySettings): string | null {
  if (settings.smtp_enabled) return 'SMTP';
  if (settings.graph_enabled) return 'Microsoft Graph';
  if (settings.resend_enabled) return 'Resend';
  return null;
}

function SetupPreview({ settings, onNavigateToIntegrations }: { settings: CompanySettings; onNavigateToIntegrations?: () => void }) {
  const method = getEnabledMethod(settings);

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-amber-300 mb-1">Verbinding vereist</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              {method} is geactiveerd maar de verbinding is nog niet getest. Test de verbinding in de integratie-instellingen om e-mails te kunnen versturen.
            </p>
            {onNavigateToIntegrations && (
              <button
                onClick={onNavigateToIntegrations}
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Ga naar Integraties
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 opacity-50 pointer-events-none select-none">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-100">Nieuwe E-mail</h3>
          <span className="text-xs text-gray-500 bg-dark-800 px-3 py-1 rounded-full border border-dark-700">
            Via {method}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Aan</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  disabled
                  placeholder="email@voorbeeld.nl"
                  className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-500 rounded-lg text-sm"
                />
              </div>
              <div className="px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-gray-600">
                <User size={16} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Onderwerp</label>
            <input
              type="text"
              disabled
              placeholder="Onderwerp van de e-mail"
              className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-500 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Bericht</label>
            <div className="w-full h-48 bg-dark-800 border border-dark-600 rounded-lg p-3">
              <div className="space-y-2">
                <div className="h-3 bg-dark-700 rounded w-3/4" />
                <div className="h-3 bg-dark-700 rounded w-full" />
                <div className="h-3 bg-dark-700 rounded w-5/6" />
                <div className="h-3 bg-dark-700 rounded w-2/3" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Paperclip size={12} />
            <span>Bijlagen worden automatisch toegevoegd bij factuurverzending</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-600/50 text-white/50 px-5 py-2.5 rounded-lg font-medium text-sm">
            <Send size={16} />
            Versturen
          </div>
        </div>
      </div>
    </div>
  );
}

function SentPreview() {
  const exampleLogs = [
    { name: 'Voorbeeld Huurder B.V.', email: 'info@voorbeeld.nl', subject: 'Factuur #2024-001 - Januari 2024', status: 'sent' as const, time: '2 uur geleden', method: 'SMTP' },
    { name: 'Test Bedrijf', email: 'admin@testbedrijf.nl', subject: 'Factuur #2024-002 - Februari 2024', status: 'sent' as const, time: 'Gisteren', method: 'SMTP' },
    { name: 'Demo Klant', email: 'contact@demo.nl', subject: 'Creditnota #CN-2024-001', status: 'failed' as const, time: '3 dagen geleden', method: 'SMTP' },
  ];

  const statusConfig = {
    sent: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    failed: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  };

  return (
    <div className="space-y-4 opacity-50 pointer-events-none select-none">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Verzonden Items</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">3 e-mails</span>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          disabled
          placeholder="Zoek in verzonden items..."
          className="w-full pl-9 pr-3 py-2 bg-dark-800 border border-dark-700 text-gray-500 rounded-lg text-sm"
        />
      </div>

      <div className="space-y-1">
        {exampleLogs.map((log, i) => {
          const status = statusConfig[log.status];
          const StatusIcon = status.icon;
          return (
            <div key={i} className="bg-dark-900 border border-dark-700 rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${status.bg} border`}>
                  <StatusIcon size={14} className={status.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-100 truncate">{log.name}</span>
                    <span className="text-xs text-gray-500 truncate hidden sm:inline">&lt;{log.email}&gt;</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{log.subject}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-600 bg-dark-800 px-2 py-0.5 rounded border border-dark-700">{log.method}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{log.time}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EmailTab({ onOpenInSplitscreen, onNavigateToIntegrations }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('compose');
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const splitscreenEnabled = localStorage.getItem('hal5-splitscreen') === 'true';
  const isElectron = !!(window as any).electronAPI;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setCompanySettings(data);
    setLoading(false);
  };

  const handleEmailSent = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveSubTab('sent');
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-gold-500" size={32} />
      </div>
    );
  }

  const configured = companySettings && isEmailConfigured(companySettings);
  const enabledButNotConnected = companySettings && !configured && (
    companySettings.smtp_enabled || companySettings.graph_enabled || companySettings.resend_enabled
  );

  const subTabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'compose', label: 'Opstellen', icon: <Send size={16} /> },
    { id: 'sent', label: 'Verzonden', icon: <Inbox size={16} /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 sticky top-0 z-10 bg-dark-950 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-100">E-mail</h2>
          <div className="flex items-center gap-2">
            {configured && (
              <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
                <CheckCircle2 size={12} />
                Verbonden
              </span>
            )}
            {enabledButNotConnected && (
              <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                <Clock size={12} />
                Verbinding vereist
              </span>
            )}
            {splitscreenEnabled && isElectron && onOpenInSplitscreen && (
              <button
                onClick={onOpenInSplitscreen}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 transition-colors"
                title="Open in splitscreen"
              >
                <ExternalLink size={14} />
                Splitscreen
              </button>
            )}
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-1.5">
          <div className="flex gap-1">
            {subTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm ${
                  activeSubTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-dark-800 hover:text-gray-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto pr-1">
        <div className="bg-dark-900 rounded-xl border border-dark-700 p-6">
          {configured && companySettings ? (
            <>
              {activeSubTab === 'compose' && (
                <EmailCompose
                  companySettings={companySettings}
                  onSent={handleEmailSent}
                />
              )}
              {activeSubTab === 'sent' && (
                <EmailSentItems refreshTrigger={refreshTrigger} />
              )}
            </>
          ) : enabledButNotConnected && companySettings ? (
            <>
              {activeSubTab === 'compose' && (
                <SetupPreview settings={companySettings} onNavigateToIntegrations={onNavigateToIntegrations} />
              )}
              {activeSubTab === 'sent' && (
                <SentPreview />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-16">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
                  <Mail size={32} className="text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-100 mb-3">E-mail niet geconfigureerd</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Activeer een e-mail methode (SMTP, Microsoft Graph of Resend) in de integratie-instellingen.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
