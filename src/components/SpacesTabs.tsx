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

      <div className="flex gap-2 mb-6 border-b border-dark-700">
        <button
          onClick={() => setActiveTab('spaces')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'spaces'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Building2 size={20} />
          Ruimtes
        </button>
        <button
          onClick={() => setActiveTab('rates')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'rates'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Calculator size={20} />
          Tarieven
        </button>
      </div>

      {activeTab === 'spaces' && <SpaceManagement />}
      {activeTab === 'rates' && <SpaceTypeRates />}
    </div>
  );
}
