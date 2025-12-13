import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { TenantManagement } from './components/TenantManagement';
import { LeaseManagement } from './components/LeaseManagement';
import { SpaceManagement } from './components/SpaceManagement';
import { SpaceTypeRates } from './components/SpaceTypeRates';
import { CompanySettings } from './components/CompanySettings';
import { MeetingRoomBookings } from './components/MeetingRoomBookings';
import { PinLogin } from './components/PinLogin';
import { InvoiceManagement } from './components/InvoiceManagement';
import { DebtorsOverview } from './components/DebtorsOverview';
import { CreditNotes } from './components/CreditNotes';
import { CreditOverview } from './components/CreditOverview';
import { Analytics } from './components/Analytics';
import { LayoutDashboard, Users, Building, Settings, CalendarClock, LogOut, Euro, TrendingUp, FileText, AlertTriangle, Receipt, DollarSign, Building2, Calculator } from 'lucide-react';

type Tab = 'dashboard' | 'rental-fulltime' | 'rental-contracts' | 'spaces-spaces' | 'spaces-rates' | 'bookings' | 'financial-invoices' | 'financial-debtors' | 'financial-creditnotes' | 'financial-creditoverview' | 'analytics' | 'settings';

type MenuSection = {
  id: string;
  label: string;
  icon: any;
  children?: { id: Tab; label: string; icon: any }[];
};

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

  const navigation: MenuSection[] = [
    { id: 'dashboard', label: 'Overzicht', icon: LayoutDashboard },
    {
      id: 'spaces',
      label: 'Ruimtes',
      icon: Building,
      children: [
        { id: 'spaces-spaces' as Tab, label: 'Ruimtes', icon: Building2 },
        { id: 'spaces-rates' as Tab, label: 'Tarieven', icon: Calculator },
      ],
    },
    {
      id: 'rental',
      label: 'Huur',
      icon: Users,
      children: [
        { id: 'rental-fulltime' as Tab, label: 'Huurders', icon: Users },
        { id: 'rental-contracts' as Tab, label: 'Huur Contracten', icon: FileText },
      ],
    },
    { id: 'bookings', label: 'Vergaderruimte', icon: CalendarClock },
    {
      id: 'financial',
      label: 'Facturatie',
      icon: Euro,
      children: [
        { id: 'financial-invoices' as Tab, label: 'Facturen', icon: FileText },
        { id: 'financial-debtors' as Tab, label: 'Debiteuren', icon: AlertTriangle },
        { id: 'financial-creditnotes' as Tab, label: 'Credit Nota\'s', icon: Receipt },
        { id: 'financial-creditoverview' as Tab, label: 'Credit Overzicht', icon: DollarSign },
      ],
    },
    { id: 'analytics', label: 'Analyses', icon: TrendingUp },
  ];

  const bottomNavigation: MenuSection[] = [
    { id: 'settings', label: 'Verhuurder', icon: Settings },
  ];

  const isActiveTab = (itemId: string, children?: { id: Tab }[]) => {
    if (children) {
      return children.some(child => child.id === activeTab);
    }
    return activeTab === itemId;
  };


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
    <div className="h-screen bg-dark-950 flex flex-col overflow-hidden">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex gap-6 overflow-hidden">
        <aside className="w-64 flex-shrink-0 self-start" style={{ maxHeight: 'calc(100vh - 3rem)' }}>
          <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2 flex flex-col" style={{ maxHeight: 'calc(100vh - 3rem)' }}>
              <div className="px-4 py-3 mb-2 flex-shrink-0">
                <h2 className="text-xl font-bold text-gold-500">HAL5 Facturatie</h2>
                <p className="text-sm text-gray-400 mt-1">Beheer systeem</p>
              </div>
              <nav className="space-y-1 flex-1 overflow-y-auto overflow-x-hidden">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActiveTab(item.id, item.children);

                  if (item.children) {
                    return (
                      <div key={item.id}>
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveTab(item.children![0].id);
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                            isActive ? 'text-gold-500 hover:text-gold-400' : 'text-gray-100 hover:text-white'
                          }`}>
                          <Icon size={20} />
                          {item.label}
                        </button>
                        <div className="ml-4 mt-1 space-y-1">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            const isChildActive = activeTab === child.id;
                            return (
                              <button
                                key={child.id}
                                type="button"
                                tabIndex={-1}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setActiveTab(child.id);
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  isChildActive
                                    ? 'bg-gold-500 text-dark-950'
                                    : 'text-gray-400 hover:bg-dark-800 hover:text-gray-300'
                                }`}
                              >
                                <ChildIcon size={18} />
                                {child.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTab(item.id as Tab);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
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
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTab(item.id as Tab);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
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

          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="bg-dark-950 pb-6">
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'spaces-spaces' && <SpaceManagement />}
              {activeTab === 'spaces-rates' && <SpaceTypeRates />}
              {activeTab === 'rental-fulltime' && <TenantManagement />}
              {activeTab === 'rental-contracts' && <LeaseManagement />}
              {activeTab === 'bookings' && <MeetingRoomBookings />}
              {activeTab === 'financial-invoices' && <InvoiceManagement />}
              {activeTab === 'financial-debtors' && <DebtorsOverview />}
              {activeTab === 'financial-creditnotes' && <CreditNotes />}
              {activeTab === 'financial-creditoverview' && <CreditOverview />}
              {activeTab === 'analytics' && <Analytics />}
              {activeTab === 'settings' && <CompanySettings />}
            </div>
          </main>
      </div>
    </div>
  );
}

export default App;
