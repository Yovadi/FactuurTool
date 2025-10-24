import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { TenantManagement } from './components/TenantManagement';
import { SpaceManagement } from './components/SpaceManagement';
import { LeaseManagement } from './components/LeaseManagement';
import { InvoiceManagement } from './components/InvoiceManagement';
import { CompanySettings } from './components/CompanySettings';
import { LayoutDashboard, Users, Building, FileText, ScrollText, Settings } from 'lucide-react';

type Tab = 'dashboard' | 'tenants' | 'spaces' | 'leases' | 'invoices' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const navigation = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenants' as Tab, label: 'Huurders', icon: Users },
    { id: 'spaces' as Tab, label: 'Ruimtes', icon: Building },
    { id: 'leases' as Tab, label: 'Huurcontracten', icon: ScrollText },
    { id: 'invoices' as Tab, label: 'Facturen', icon: FileText },
    { id: 'settings' as Tab, label: 'Verhuurder', icon: Settings },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="text-white font-bold text-xl">HAL5 Overloon</div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0">
            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-2">
              <nav className="space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-yellow-500 text-gray-900'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <Icon size={20} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="bg-gray-900">
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'tenants' && <TenantManagement />}
              {activeTab === 'spaces' && <SpaceManagement />}
              {activeTab === 'leases' && <LeaseManagement />}
              {activeTab === 'invoices' && <InvoiceManagement />}
              {activeTab === 'settings' && <CompanySettings />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
