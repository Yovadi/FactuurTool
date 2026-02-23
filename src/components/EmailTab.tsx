import { useState, useEffect } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { isEmailConfigured } from '../utils/emailSender';
import { EmailCompose } from './EmailCompose';
import { EmailSentItems } from './EmailSentItems';
import { Mail, Send, Inbox, Loader2, Settings, ExternalLink } from 'lucide-react';

type SubTab = 'compose' | 'sent';

type Props = {
  onOpenInSplitscreen?: () => void;
};

export function EmailTab({ onOpenInSplitscreen }: Props) {
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

  if (!companySettings || !isEmailConfigured(companySettings)) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-shrink-0 sticky top-0 z-10 bg-dark-950 pb-4">
          <h2 className="text-2xl font-bold text-gray-100">E-mail</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
              <Mail size={32} className="text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-100 mb-3">E-mail niet geconfigureerd</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Om e-mails te versturen vanuit deze applicatie, configureer eerst een e-mail methode
              (SMTP, Microsoft Graph API of Resend) in de Integraties instellingen.
            </p>
            <div className="flex items-center gap-2 justify-center">
              <Settings size={14} className="text-gray-500" />
              <span className="text-sm text-gray-500">Verhuurder &gt; Integraties &gt; E-mail</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const subTabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'compose', label: 'Opstellen', icon: <Send size={16} /> },
    { id: 'sent', label: 'Verzonden', icon: <Inbox size={16} /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 sticky top-0 z-10 bg-dark-950 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-100">E-mail</h2>
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
          {activeSubTab === 'compose' && (
            <EmailCompose
              companySettings={companySettings}
              onSent={handleEmailSent}
            />
          )}
          {activeSubTab === 'sent' && (
            <EmailSentItems refreshTrigger={refreshTrigger} />
          )}
        </div>
      </div>
    </div>
  );
}
