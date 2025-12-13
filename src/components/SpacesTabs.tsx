import { useState } from 'react';
import { SpaceManagement } from './SpaceManagement';
import { SpaceTypeRates } from './SpaceTypeRates';
import { Building2, Calculator } from 'lucide-react';

export function SpacesTabs() {
  const [activeTab, setActiveTab] = useState<'spaces' | 'rates'>('spaces');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Kantoor Beheer</h2>
      </div>

      <div className="sticky top-0 z-10 bg-dark-950 pb-2 mb-4">
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
            Ruimtes
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

      {activeTab === 'spaces' && <SpaceManagement />}
      {activeTab === 'rates' && <SpaceTypeRates />}
    </div>
  );
}
