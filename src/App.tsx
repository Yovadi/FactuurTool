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
import { LayoutDashboard, Users, Building, FileText, ScrollText, Settings, CalendarClock, TrendingUp } from 'lucide-react';

type Tab = 'dashboard' | 'tenants' | 'spaces' | 'leases' | 'invoices' | 'bookings' | 'analytics' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Detect if running in Electron or development mode
    const electron = typeof window !== 'undefined' && (window as any).electron;
    const isDev = import.meta.env.DEV;
    // Show admin interface in Electron OR in development mode
    setIsElectron(!!electron || isDev);
  }, []);

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

  // If running on production web (Netlify), show only booking calendar
  // In development (Bolt/localhost) or Electron, show full admin interface
  if (!isElectron) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <BookingCalendar />
      </div>
    );
  }

  // If running in Electron, show full admin interface
  return (
    <div className="min-h-screen bg-dark-950">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              {activeTab === 'bookings' && <MeetingRoomBookings />}
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
