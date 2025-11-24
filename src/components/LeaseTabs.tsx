import { useState } from 'react';
import { TenantManagement } from './TenantManagement';
import { PartTimeAvailability } from './PartTimeAvailability';
import { Building2, Calendar } from 'lucide-react';

type LeaseTab = 'fulltime' | 'parttime';

export function LeaseTabs() {
  const [activeTab, setActiveTab] = useState<LeaseTab>('fulltime');

  const tabs = [
    { id: 'fulltime' as LeaseTab, label: 'Voltijd', icon: Building2 },
    { id: 'parttime' as LeaseTab, label: 'Deeltijd', icon: Calendar },
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
        {activeTab === 'parttime' && <PartTimeAvailability />}
      </div>
    </div>
  );
}
