import { useState } from 'react';
import { LayoutDashboard, TrendingUp } from 'lucide-react';
import { Dashboard } from './Dashboard';
import { Analytics } from './Analytics';

export function OverzichtTabs() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics'>('dashboard');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Overzicht</h2>
      </div>

      <div className="flex-shrink-0 mb-4">
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <LayoutDashboard size={20} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <TrendingUp size={20} />
              Analyses
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'analytics' && <Analytics />}
      </div>
    </div>
  );
}
