import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { TenantManagement } from './components/TenantManagement';
import { SpaceManagement } from './components/SpaceManagement';
import { LeaseManagement } from './components/LeaseManagement';
import { InvoiceManagement } from './components/InvoiceManagement';
import { CompanySettings } from './components/CompanySettings';
import { MeetingRoomBookings } from './components/MeetingRoomBookings';
import { BookingCalendar } from './components/BookingCalendar';
import { Analytics } from './components/Analytics';
import { Login } from './components/Login';
import { supabase } from './lib/supabase';
import { LayoutDashboard, Users, Building, FileText, ScrollText, Settings, CalendarClock, TrendingUp, LogOut, UserCircle } from 'lucide-react';

type Tab = 'dashboard' | 'tenants' | 'spaces' | 'leases' | 'invoices' | 'bookings' | 'analytics' | 'settings';

type LoggedInUser = {
  id: string;
  name: string;
  company_name: string;
  isAdmin: boolean;
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('bookings');
  const [isElectron, setIsElectron] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Detect if running in Electron or development mode
    const electron = typeof window !== 'undefined' && (window as any).electron;
    const isDev = import.meta.env.DEV;
    // Show admin interface in Electron OR in development mode
    setIsElectron(!!electron || isDev);

    // Check for saved login
    const savedUser = localStorage.getItem('logged_in_user');
    if (savedUser) {
      setLoggedInUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = async (tenantId: string, isAdmin: boolean) => {
    if (isAdmin) {
      const user: LoggedInUser = {
        id: 'admin',
        name: 'Beheerder',
        company_name: 'HAL5',
        isAdmin: true
      };
      setLoggedInUser(user);
      localStorage.setItem('logged_in_user', JSON.stringify(user));
      setActiveTab(isElectron ? 'dashboard' : 'bookings');
    } else {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name, company_name')
        .eq('id', tenantId)
        .single();

      if (tenant) {
        const user: LoggedInUser = {
          id: tenant.id,
          name: tenant.name,
          company_name: tenant.company_name || tenant.name,
          isAdmin: false
        };
        setLoggedInUser(user);
        localStorage.setItem('logged_in_user', JSON.stringify(user));
        setActiveTab('bookings');
      }
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    localStorage.removeItem('logged_in_user');
    setActiveTab('bookings');
  };

  const navigation = [
    { id: 'dashboard' as Tab, label: 'Overzicht', icon: LayoutDashboard },
    { id: 'tenants' as Tab, label: 'Huurders', icon: Users },
    { id: 'spaces' as Tab, label: 'Ruimtes', icon: Building },
    { id: 'leases' as Tab, label: 'Huurcontracten', icon: ScrollText },
    { id: 'bookings' as Tab, label: 'Vergaderruimte', icon: CalendarClock },
    { id: 'invoices' as Tab, label: 'Facturen', icon: FileText },
    { id: 'analytics' as Tab, label: 'Analyses', icon: TrendingUp },
    { id: 'settings' as Tab, label: 'Verhuurder', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <p className="text-gray-300">Laden...</p>
      </div>
    );
  }

  // Show login if not logged in
  if (!loggedInUser) {
    return <Login onLogin={handleLogin} />;
  }

  // If running on production web (Netlify) and logged in as tenant, show only booking calendar
  if (!isElectron && !loggedInUser.isAdmin) {
    return (
      <div className="min-h-screen bg-dark-950 p-4">
        <div className="max-w-[1920px] mx-auto">
          <div className="flex justify-between items-center mb-6 bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="flex items-center gap-3">
              <UserCircle className="text-gold-500" size={32} />
              <div>
                <p className="text-sm text-gray-400">Ingelogd als</p>
                <p className="text-lg font-semibold text-gray-100">{loggedInUser.company_name}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              Uitloggen
            </button>
          </div>
          <MeetingRoomBookings loggedInTenantId={loggedInUser.id} />
        </div>
      </div>
    );
  }

  // If running in Electron or admin, show full admin interface
  return (
    <div className="min-h-screen bg-dark-950">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center mb-6 bg-dark-900 rounded-lg p-4 border border-dark-700">
          <div className="flex items-center gap-3">
            <UserCircle className="text-gold-500" size={32} />
            <div>
              <p className="text-sm text-gray-400">Ingelogd als</p>
              <p className="text-lg font-semibold text-gray-100">
                {loggedInUser.isAdmin ? 'Beheerder - HAL5' : loggedInUser.company_name}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Uitloggen
          </button>
        </div>

        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0">
            <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
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
              </nav>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="bg-dark-950">
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'tenants' && <TenantManagement />}
              {activeTab === 'spaces' && <SpaceManagement />}
              {activeTab === 'leases' && <LeaseManagement />}
              {activeTab === 'invoices' && <InvoiceManagement />}
              {activeTab === 'bookings' && <MeetingRoomBookings loggedInTenantId={loggedInUser.isAdmin ? null : loggedInUser.id} />}
              {activeTab === 'analytics' && <Analytics />}
              {activeTab === 'settings' && <CompanySettings />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
