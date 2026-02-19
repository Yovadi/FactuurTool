import { useState } from 'react';
import { CompanyInfo } from './CompanyInfo';
import { BuildingInfo } from './BuildingInfo';
import { AppInfo } from './AppInfo';
import { Integrations } from './Integrations';
import { Automatiseringen } from './Automatiseringen';
import { Building2, Home, Settings, Plug, Zap } from 'lucide-react';

type Tab = 'company' | 'building' | 'app' | 'integrations' | 'automatiseringen';

export function VerhuurderTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('company');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'company', label: 'Bedrijfsgegevens', icon: <Building2 size={20} /> },
    { id: 'building', label: 'Pand Informatie', icon: <Home size={20} /> },
    { id: 'app', label: 'App Gegevens', icon: <Settings size={20} /> },
    { id: 'integrations', label: 'Integraties', icon: <Plug size={20} /> },
    { id: 'automatiseringen', label: 'Automatiseringen', icon: <Zap size={20} /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 sticky top-0 z-10 bg-dark-950 pb-4">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Verhuurder</h2>
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
          <div className="flex gap-2 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gold-500 text-white'
                    : 'text-gray-300 hover:bg-dark-800'
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
        {activeTab === 'company' && <CompanyInfo />}
        {activeTab === 'building' && <BuildingInfo />}
        {activeTab === 'app' && <AppInfo />}
        {activeTab === 'integrations' && <Integrations />}
        {activeTab === 'automatiseringen' && <Automatiseringen />}
      </div>
    </div>
  );
}
