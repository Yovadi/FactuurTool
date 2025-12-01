import { useState } from 'react';
import { TenantManagement } from './TenantManagement';
import { PartTimeAvailability } from './PartTimeAvailability';
import { LeaseManagement } from './LeaseManagement';
import { Users, Calendar, FileText } from 'lucide-react';

export function RentalTabs() {
  const [activeTab, setActiveTab] = useState<'fulltime' | 'parttime' | 'contracts'>('fulltime');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Huur Beheer</h2>
      </div>

      <div className="flex gap-2 mb-6 border-b border-dark-700">
        <button
          onClick={() => setActiveTab('fulltime')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'fulltime'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Users size={20} />
          Voltijd
        </button>
        <button
          onClick={() => setActiveTab('parttime')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'parttime'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Calendar size={20} />
          Deeltijd
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'contracts'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <FileText size={20} />
          Huur Contracten
        </button>
      </div>

      {activeTab === 'fulltime' && <TenantManagement />}
      {activeTab === 'parttime' && <PartTimeAvailability />}
      {activeTab === 'contracts' && <LeaseManagement />}
    </div>
  );
}
