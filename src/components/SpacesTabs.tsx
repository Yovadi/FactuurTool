import { useState } from 'react';
import { SpaceManagement } from './SpaceManagement';
import { PartTimeAvailability } from './PartTimeAvailability';
import { Building, Calendar } from 'lucide-react';

type SpacesTab = 'spaces' | 'availability';

export function SpacesTabs() {
  const [activeTab, setActiveTab] = useState<SpacesTab>('spaces');

  const tabs = [
    { id: 'spaces' as SpacesTab, label: 'Ruimtes Beheer', icon: Building },
    { id: 'availability' as SpacesTab, label: 'Deeltijd Beschikbaarheid', icon: Calendar },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Kantoor Beheer</h2>
        <div className="flex gap-2 border-b border-dark-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'text-gold-500 border-gold-500'
                    : 'text-gray-400 border-transparent hover:text-gray-300'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {activeTab === 'spaces' && <SpaceManagement />}
        {activeTab === 'availability' && <PartTimeAvailability />}
      </div>
    </div>
  );
}
