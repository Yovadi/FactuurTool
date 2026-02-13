import { useState } from 'react';
import { CompanyInfo } from './CompanyInfo';
import { BuildingInfo } from './BuildingInfo';
import { AppInfo } from './AppInfo';
import { Building2, Home, Settings } from 'lucide-react';

export function VerhuurderTabs() {
  const [activeTab, setActiveTab] = useState<'company' | 'building' | 'app'>('company');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 sticky top-0 z-10 bg-dark-950 pb-4">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Verhuurder</h2>
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('company')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'company'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <Building2 size={20} />
              Bedrijfsgegevens
            </button>
            <button
              onClick={() => setActiveTab('building')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'building'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <Home size={20} />
              Pand Informatie
            </button>
            <button
              onClick={() => setActiveTab('app')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'app'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <Settings size={20} />
              App Gegevens
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto pr-1">
        {activeTab === 'company' && <CompanyInfo />}
        {activeTab === 'building' && <BuildingInfo />}
        {activeTab === 'app' && <AppInfo />}
      </div>
    </div>
  );
}
