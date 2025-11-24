import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { TenantManagement } from './components/TenantManagement';
import { PartTimeAvailability } from './components/PartTimeAvailability';
import { SpacesTabs } from './components/SpacesTabs';
import { CompanySettings } from './components/CompanySettings';
import { MeetingRoomBookings } from './components/MeetingRoomBookings';
import { PinLogin } from './components/PinLogin';
import { Financial } from './components/Financial';
import { LayoutDashboard, Users, Building, ScrollText, Settings, CalendarClock, LogOut, Euro } from 'lucide-react';

type Tab = 'dashboard' | 'tenants' | 'parttime' | 'spaces' | 'bookings' | 'financial' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isElectron, setIsElectron] = useState(false);
  const [loggedInTenantId, setLoggedInTenantId] = useState<string | null>(null);
  const [loggedInTenantName, setLoggedInTenantName] = useState<string>('');

  useEffect(() => {
    // Detect if running in Electron or development mode
    const electron = typeof window !== 'undefined' && (window as any).electron;
    const isDev = import.meta.env.DEV;
    // isElectron is true for Electron OR development
    setIsElectron(!!electron || isDev);
  }, []);

  const navigation = [
    { id: 'dashboard' as Tab, label: 'Overzicht', icon: LayoutDashboard },
    { id: 'spaces' as Tab, label: 'Ruimtes', icon: Building },
    { id: 'tenants' as Tab, label: 'Voltijd', icon: Users },
    { id: 'parttime' as Tab, label: 'Deeltijd', icon: CalendarClock },
    { id: 'bookings' as Tab, label: 'Vergaderruimte', icon: CalendarClock },
    { id: 'financial' as Tab, label: 'Financieel', icon: Euro },
  ];

  const bottomNavigation = [
    { id: 'settings' as Tab, label: 'Verhuurder', icon: Settings },
  ];

  const handleAuthenticated = (tenantId: string, tenantName: string) => {
    setLoggedInTenantId(tenantId);
    setLoggedInTenantName(tenantName);
  };

  const handleLogout = () => {
    setLoggedInTenantId(null);
    setLoggedInTenantName('');
  };

  // On production (Netlify), show PIN login then booking calendar
  if (!isElectron) {
    if (!loggedInTenantId) {
      return <PinLogin onAuthenticated={handleAuthenticated} />;
    }

    return (
      <div className="min-h-screen bg-dark-950">
        <div className="bg-dark-900 border-b border-dark-700 px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gold-500">HAL5 Overloon</h1>
            <p className="text-sm text-gray-400">Vergaderruimte Boekingen</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">Ingelogd als</p>
              <p className="text-base font-semibold text-gray-100">{loggedInTenantName}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded-lg transition-colors border border-dark-600"
            >
              <LogOut size={18} />
              Uitloggen
            </button>
          </div>
        </div>
        <MeetingRoomBookings loggedInTenantId={loggedInTenantId} />
      </div>
    );
  }

  // On Electron/Development, show full admin interface
  return (
    <div className="min-h-screen bg-dark-950">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0">
            <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
              <div className="px-4 py-3 mb-2">
                <h2 className="text-xl font-bold text-gold-500">HAL5 Facturatie</h2>
                <p className="text-sm text-gray-400 mt-1">Beheer systeem</p>
              </div>
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
                          ? 'bg-gold-500 text-dark-950'
                          : 'text-gray-300 hover:bg-dark-800'
                      }`}
                    >
                      <Icon size={20} />
                      {item.label}
                    </button>
                  );
                })}

                <div className="my-2 border-t border-dark-700"></div>

                {bottomNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-gold-500 text-dark-950'
                          : 'text-gray-300 hover:bg-dark-800'
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
            <div className="bg-dark-950">
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'spaces' && <SpacesTabs />}
              {activeTab === 'tenants' && <TenantManagement />}
              {activeTab === 'parttime' && <PartTimeAvailability />}
              {activeTab === 'bookings' && <MeetingRoomBookings />}
              {activeTab === 'financial' && <Financial />}
              {activeTab === 'settings' && <CompanySettings />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
