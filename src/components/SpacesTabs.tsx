import { useState } from 'react';
import { SpaceManagement } from './SpaceManagement';
import { SpaceTypeRates } from './SpaceTypeRates';
import { Building2, Calculator } from 'lucide-react';

export function SpacesTabs() {
  const [activeTab, setActiveTab] = useState<'spaces' | 'rates'>('spaces');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Objecten Beheer</h2>
      </div>

      <div className="flex-shrink-0 mb-4">
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
          <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('spaces')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'spaces'
                ? 'bg-gold-500 text-dark-950'
                : 'text-gray-300 hover:bg-dark-800'
            }`}
          >
            <Building2 size={20} />
            Objecten
          </button>
          <button
            onClick={() => setActiveTab('rates')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'rates'
                ? 'bg-gold-500 text-dark-950'
                : 'text-gray-300 hover:bg-dark-800'
            }`}
          >
            <Calculator size={20} />
            Tarieven
          </button>
        </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'spaces' && <SpaceManagement />}
        {activeTab === 'rates' && <SpaceTypeRates />}
      </div>
    </div>
  );
}
