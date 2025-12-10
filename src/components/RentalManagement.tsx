import { useState } from 'react';
import { TenantManagement } from './TenantManagement';
import { LeaseManagement } from './LeaseManagement';
import { Users, FileText } from 'lucide-react';

type RentalTab = 'fulltime' | 'contracts';

export function RentalManagement() {
  const [activeTab, setActiveTab] = useState<RentalTab>('fulltime');

  const tabs = [
    { id: 'fulltime' as RentalTab, label: 'Huurders', icon: Users },
    { id: 'contracts' as RentalTab, label: 'Huur Contracten', icon: FileText },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Huur Beheer</h2>
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
        {activeTab === 'fulltime' && <TenantManagement />}
        {activeTab === 'contracts' && <LeaseManagement />}
      </div>
    </div>
  );
}
