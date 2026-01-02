import { useState, useEffect, lazy, Suspense } from 'react';
import { UpdateDialog } from './components/UpdateDialog';
import { LayoutDashboard, Users, Building, Settings, CalendarClock, LogOut, TrendingUp, FileText, Building2, Calculator, Euro, UserCheck, UserMinus, BarChart3, Loader2 } from 'lucide-react';
import { supabase } from './lib/supabase';

const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TenantManagement = lazy(() => import('./components/TenantManagement').then(m => ({ default: m.TenantManagement })));
const LeaseManagement = lazy(() => import('./components/LeaseManagement').then(m => ({ default: m.LeaseManagement })));
const SpaceManagement = lazy(() => import('./components/SpaceManagement').then(m => ({ default: m.SpaceManagement })));
const SpaceTypeRates = lazy(() => import('./components/SpaceTypeRates').then(m => ({ default: m.SpaceTypeRates })));
const FlexOccupancy = lazy(() => import('./components/FlexOccupancy').then(m => ({ default: m.FlexOccupancy })));
const CompanySettings = lazy(() => import('./components/CompanySettings').then(m => ({ default: m.CompanySettings })));
const MeetingRoomBookings = lazy(() => import('./components/MeetingRoomBookings').then(m => ({ default: m.MeetingRoomBookings })));
const PinLogin = lazy(() => import('./components/PinLogin').then(m => ({ default: m.PinLogin })));
const Analytics = lazy(() => import('./components/Analytics').then(m => ({ default: m.Analytics })));
const DebiteurenTabs = lazy(() => import('./components/DebiteurenTabs').then(m => ({ default: m.DebiteurenTabs })));
const CrediteurenTabs = lazy(() => import('./components/CrediteurenTabs').then(m => ({ default: m.CrediteurenTabs })));

type Tab = 'dashboard' | 'tenants' | 'spaces-spaces' | 'spaces-rates' | 'contracts' | 'occupancy' | 'bookings' | 'financial-debtors' | 'financial-creditors' | 'analytics' | 'settings';

type MenuSection = {
  id: string;
  label: string;
  icon: any;
  children?: { id: Tab; label: string; icon: any }[];
};

type PrefilledInvoiceData = {
  invoice: any;
  tenant: any;
  spaces: any[];
};

type UpdateDialogState = {
  show: boolean;
  type: 'update-available' | 'update-not-available' | 'update-downloaded' | 'update-error' | 'downloading';
  currentVersion?: string;
  newVersion?: string;
  error?: string;
  progress?: number;
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isElectron, setIsElectron] = useState(false);
  const [loggedInTenantId, setLoggedInTenantId] = useState<string | null>(null);
  const [loggedInTenantName, setLoggedInTenantName] = useState<string>('');
  const [prefilledInvoiceData, setPrefilledInvoiceData] = useState<PrefilledInvoiceData | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  const [updateDialog, setUpdateDialog] = useState<UpdateDialogState>({
    show: false,
    type: 'update-not-available'
  });

  useEffect(() => {
    const isElectronApp = !!(window as any).electronAPI;
    setIsElectron(isElectronApp);

    if ((window as any).electron?.getAppVersion) {
      (window as any).electron.getAppVersion().then((version: string) => {
        setAppVersion(version);
      }).catch((err: any) => {
        console.error('Error getting app version:', err);
      });
    }

    if ((window as any).electron?.onUpdateAvailable) {
      (window as any).electron.onUpdateAvailable((data: any) => {
        setUpdateDialog({
          show: true,
          type: 'update-available',
          currentVersion: data.currentVersion,
          newVersion: data.newVersion
        });
      });
    }

    if ((window as any).electron?.onUpdateNotAvailable) {
      (window as any).electron.onUpdateNotAvailable((data: any) => {
        setUpdateDialog({
          show: true,
          type: 'update-not-available',
          currentVersion: data.currentVersion
        });
      });
    }

    if ((window as any).electron?.onUpdateDownloaded) {
      (window as any).electron.onUpdateDownloaded(() => {
        setUpdateDialog({
          show: true,
          type: 'update-downloaded'
        });
      });
    }

    if ((window as any).electron?.onUpdateError) {
      (window as any).electron.onUpdateError((data: any) => {
        setUpdateDialog({
          show: true,
          type: 'update-error',
          error: data.error
        });
      });
    }

    if ((window as any).electron?.onDownloadProgress) {
      (window as any).electron.onDownloadProgress((data: any) => {
        setUpdateDialog(prev => ({
          ...prev,
          show: true,
          type: 'downloading',
          progress: data.percent
        }));
      });
    }

    if (isElectronApp) {
      setTimeout(() => {
        syncFolders();
      }, 1000);
    }
  }, []);

  const syncFolders = async () => {
    try {
      console.log('🔄 Starting folder sync...');

      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('📁 Root folder path:', settings?.root_folder_path);
      console.log('🔌 electronAPI available:', !!(window as any).electronAPI?.createTenantFolder);

      if (!settings?.root_folder_path) {
        console.log('⚠️ No root folder path configured');
        return;
      }

      if (!(window as any).electronAPI?.createTenantFolder) {
        console.log('⚠️ electronAPI not available');
        return;
      }

      const { data: tenants } = await supabase
        .from('tenants')
        .select('company_name');

      const { data: externalCustomers } = await supabase
        .from('external_customers')
        .select('company_name');

      const allCustomers = [
        ...(tenants || []).map(t => t.company_name),
        ...(externalCustomers || []).map(c => c.company_name)
      ];

      console.log(`📋 Syncing folders for ${allCustomers.length} customers...`);

      for (const companyName of allCustomers) {
        const result = await (window as any).electronAPI.createTenantFolder(
          settings.root_folder_path,
          companyName
        );
        console.log(`✓ ${companyName}:`, result.success ? 'OK' : result.error);
      }

      console.log('✅ Folder sync complete');
    } catch (error) {
      console.error('❌ Error syncing folders:', error);
    }
  };

  const navigation: MenuSection[] = [
    { id: 'dashboard', label: 'Overzicht', icon: LayoutDashboard },
    { id: 'tenants', label: 'Huurders', icon: Users },
    {
      id: 'spaces',
      label: 'Ruimtes',
      icon: Building,
      children: [
        { id: 'spaces-spaces' as Tab, label: 'Ruimtes', icon: Building2 },
        { id: 'spaces-rates' as Tab, label: 'Tarieven', icon: Calculator },
      ],
    },
    { id: 'contracts', label: 'Contracten', icon: FileText },
    { id: 'occupancy', label: 'Bezetting', icon: BarChart3 },
    { id: 'bookings', label: 'Vergaderruimte', icon: CalendarClock },
    {
      id: 'financial',
      label: 'Facturatie',
      icon: Euro,
      children: [
        { id: 'financial-debtors' as Tab, label: 'Debiteuren', icon: UserCheck },
        { id: 'financial-creditors' as Tab, label: 'Crediteuren', icon: UserMinus },
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
  const LoadingFallback = () => (
    <div className="h-full flex items-center justify-center bg-dark-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="text-gold-500 animate-spin" size={32} />
        <p className="text-gray-400">Laden...</p>
      </div>
    </div>
  );

  if (!isElectron) {
    if (!loggedInTenantId) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <PinLogin onAuthenticated={handleAuthenticated} />
        </Suspense>
      );
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
        <Suspense fallback={<LoadingFallback />}>
          <MeetingRoomBookings loggedInTenantId={loggedInTenantId} />
        </Suspense>
      </div>
    );
  }

  const handleDownloadUpdate = async () => {
    if ((window as any).electron?.downloadUpdate) {
      setUpdateDialog(prev => ({ ...prev, show: true, type: 'downloading', progress: 0 }));
      await (window as any).electron.downloadUpdate();
    }
  };

  const handleInstallUpdate = async () => {
    if ((window as any).electron?.installUpdate) {
      await (window as any).electron.installUpdate();
    }
  };

  return (
    <div className="h-screen bg-dark-950 flex flex-col">
      {updateDialog.show && (
        <UpdateDialog
          type={updateDialog.type}
          currentVersion={updateDialog.currentVersion}
          newVersion={updateDialog.newVersion}
          error={updateDialog.error}
          progress={updateDialog.progress}
          onDownload={handleDownloadUpdate}
          onInstall={handleInstallUpdate}
          onClose={() => setUpdateDialog(prev => ({ ...prev, show: false }))}
        />
      )}

      <div className="flex-1 max-w-[1920px] w-full mx-auto p-6 overflow-hidden">
        <div className="flex gap-6 h-full">
          <aside className="w-64 flex-shrink-0 h-full flex flex-col overflow-hidden">
            <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2 flex flex-col flex-shrink-0">
              <div className="px-4 py-3 mb-2">
                <h2 className="text-xl font-bold text-gold-500">HAL5 Facturatie</h2>
                <p className="text-sm text-gray-400 mt-1">Beheer systeem</p>
                {appVersion && (
                  <p className="text-xs text-gray-500 mt-1">Versie {appVersion}</p>
                )}
              </div>
              <nav className="space-y-1 pb-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActiveTab(item.id, item.children);

                  if (item.children) {
                    return (
                      <div key={item.id}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveTab(item.children![0].id);
                          }}
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
                                onClick={(e) => {
                                  e.preventDefault();
                                  setActiveTab(child.id);
                                }}
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
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTab(item.id as Tab);
                      }}
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
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTab(item.id as Tab);
                      }}
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

          <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-dark-950">
            <Suspense fallback={<LoadingFallback />}>
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'tenants' && <TenantManagement />}
              {activeTab === 'spaces-spaces' && <SpaceManagement />}
              {activeTab === 'spaces-rates' && <SpaceTypeRates />}
              {activeTab === 'contracts' && <LeaseManagement />}
              {activeTab === 'occupancy' && <FlexOccupancy />}
              {activeTab === 'bookings' && <MeetingRoomBookings />}
              {activeTab === 'financial-debtors' && (
                <DebiteurenTabs
                  onCreateCreditNote={(invoice, tenant, spaces) => {
                    setPrefilledInvoiceData({ invoice, tenant, spaces });
                    setActiveTab('financial-creditors');
                  }}
                />
              )}
              {activeTab === 'financial-creditors' && (
                <CrediteurenTabs
                  prefilledInvoiceData={prefilledInvoiceData}
                  onClearPrefilled={() => setPrefilledInvoiceData(null)}
                />
              )}
              {activeTab === 'analytics' && <Analytics />}
              {activeTab === 'settings' && <CompanySettings />}
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
