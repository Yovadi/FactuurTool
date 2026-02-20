import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { UpdateDialog } from './components/UpdateDialog';
import { LayoutDashboard, Users, Building, Settings, CalendarClock, Calendar, FileText, Building2, Calculator, Euro, UserCheck, UserMinus, Loader2, Menu, X, Database, Bell, AlertTriangle, TrendingUp, CalendarCheck, DoorOpen } from 'lucide-react';
import { supabase } from './lib/supabase';
import { markAllNotificationsRead } from './utils/notificationHelper';

const OverzichtTabs = lazy(() => import('./components/OverzichtTabs').then(m => ({ default: m.OverzichtTabs })));
const TenantManagement = lazy(() => import('./components/TenantManagement').then(m => ({ default: m.TenantManagement })));
const LeaseManagement = lazy(() => import('./components/LeaseManagement').then(m => ({ default: m.LeaseManagement })));
const SpaceManagement = lazy(() => import('./components/SpaceManagement').then(m => ({ default: m.SpaceManagement })));
const SpaceTypeRates = lazy(() => import('./components/SpaceTypeRates').then(m => ({ default: m.SpaceTypeRates })));
const VerhuurderTabs = lazy(() => import('./components/VerhuurderTabs').then(m => ({ default: m.VerhuurderTabs })));
const MeetingRoomBookings = lazy(() => import('./components/MeetingRoomBookings').then(m => ({ default: m.MeetingRoomBookings })));
const FlexWorkspaceBookings = lazy(() => import('./components/FlexWorkspaceBookings').then(m => ({ default: m.FlexWorkspaceBookings })));
const DebiteurenTabs = lazy(() => import('./components/DebiteurenTabs').then(m => ({ default: m.DebiteurenTabs })));
const CrediteurenTabs = lazy(() => import('./components/CrediteurenTabs').then(m => ({ default: m.CrediteurenTabs })));
const EBoekhoudenDashboard = lazy(() => import('./components/EBoekhoudenDashboard').then(m => ({ default: m.EBoekhoudenDashboard })));

type Tab = 'dashboard' | 'tenants' | 'spaces-spaces' | 'spaces-rates' | 'contracts' | 'bookings' | 'flex-bookings' | 'financial-debtors' | 'financial-creditors' | 'eboekhouden' | 'settings';

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
  const [prefilledInvoiceData, setPrefilledInvoiceData] = useState<PrefilledInvoiceData | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [eBoekhoudenEnabled, setEBoekhoudenEnabled] = useState(false);
  const [updateDialog, setUpdateDialog] = useState<UpdateDialogState>({
    show: false,
    type: 'update-not-available'
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

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

    setTimeout(() => {
      setIsInitialized(true);
    }, 100);

    supabase
      .from('company_settings')
      .select('eboekhouden_enabled')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.eboekhouden_enabled) setEBoekhoudenEnabled(true);
      });

    const handleEboekhoudenChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEBoekhoudenEnabled(detail.enabled);
      if (!detail.enabled) setActiveTab(prev => prev === 'eboekhouden' ? 'settings' : prev);
    };
    window.addEventListener('eboekhouden-enabled-changed', handleEboekhoudenChange);

    loadNotifications();
    const notifInterval = setInterval(loadNotifications, 60000);

    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('eboekhouden-enabled-changed', handleEboekhoudenChange);
      clearInterval(notifInterval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

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
      label: 'Producten',
      icon: Building,
      children: [
        { id: 'spaces-spaces' as Tab, label: 'Producten', icon: Building2 },
        { id: 'spaces-rates' as Tab, label: 'Tarieven', icon: Calculator },
      ],
    },
    { id: 'contracts', label: 'Contracten', icon: FileText },
    { id: 'bookings', label: 'Vergaderruimte', icon: CalendarClock },
    { id: 'flex-bookings', label: 'Flexplekken', icon: Calendar },
    {
      id: 'financial',
      label: 'Facturatie',
      icon: Euro,
      children: [
        { id: 'financial-debtors' as Tab, label: 'Debiteuren', icon: UserCheck },
        { id: 'financial-creditors' as Tab, label: 'Crediteuren', icon: UserMinus },
      ],
    },
    ...(eBoekhoudenEnabled ? [{ id: 'eboekhouden', label: 'e-Boekhouden', icon: Database }] : []),
  ] as MenuSection[];

  const bottomNavigation: MenuSection[] = [
    { id: 'settings', label: 'Verhuurder', icon: Settings },
  ];

  const isActiveTab = (itemId: string, children?: { id: Tab }[]) => {
    if (children) {
      return children.some(child => child.id === activeTab);
    }
    return activeTab === itemId;
  };

  const LoadingFallback = () => (
    <div className="h-full flex items-center justify-center bg-dark-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="text-gold-500 animate-spin" size={32} />
        <p className="text-gray-400">Laden...</p>
      </div>
    </div>
  );


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

  if (!isInitialized) {
    return (
      <div className="h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-gold-500 animate-spin" size={48} />
          <p className="text-gray-400">Applicatie laden...</p>
        </div>
      </div>
    );
  }

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

      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-3 bg-dark-900 border border-dark-700 rounded-lg text-gray-100 hover:bg-dark-800 transition-colors shadow-lg"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex-1 max-w-[1920px] w-full mx-auto lg:p-6 p-0 overflow-hidden">
        <div className="flex gap-0 lg:gap-6 h-full">
          <aside className={`
            w-72 sm:w-80 lg:w-64 flex-shrink-0 h-full flex flex-col overflow-hidden
            fixed lg:relative inset-y-0 left-0 z-40
            transform transition-transform duration-300 ease-in-out
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            lg:transform-none
            p-4 lg:p-0
          `}>
            <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2 flex flex-col flex-shrink-0 h-full overflow-y-auto">
              <div className="px-4 py-3 mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gold-500">HAL5 Facturatie</h2>
                  <p className="text-sm text-gray-400 mt-1">Beheer systeem</p>
                  {appVersion && (
                    <p className="text-xs text-gray-500 mt-1">Versie {appVersion}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative" ref={notifRef}>
                    <button
                      onClick={() => setNotifOpen(o => !o)}
                      className="relative p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded-lg hover:bg-dark-800"
                      title="Meldingen"
                    >
                      <Bell size={18} />
                      {notifications.filter(n => !n.is_read).length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gold-500 text-dark-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                          {notifications.filter(n => !n.is_read).length > 9 ? '9+' : notifications.filter(n => !n.is_read).length}
                        </span>
                      )}
                    </button>

                    {notifOpen && (
                      <div className="absolute left-0 top-full mt-2 w-80 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
                          <span className="text-sm font-semibold text-gray-100">Meldingen</span>
                          {notifications.some(n => !n.is_read) && (
                            <button
                              onClick={handleMarkAllRead}
                              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                            >
                              Alles gelezen
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-gray-500 text-sm">Geen meldingen</div>
                          ) : (
                            notifications.map(n => {
                              const iconMap: Record<string, React.ReactNode> = {
                                lease_expiring_30: <AlertTriangle size={14} className="text-red-400" />,
                                lease_expiring_60: <AlertTriangle size={14} className="text-amber-400" />,
                                rent_indexation_applied: <TrendingUp size={14} className="text-green-400" />,
                                booking_cancelled: <DoorOpen size={14} className="text-red-400" />,
                                booking_pending: <CalendarCheck size={14} className="text-amber-400" />,
                              };
                              const icon = iconMap[n.notification_type] || <Bell size={14} className="text-gray-400" />;
                              const date = new Date(n.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
                              return (
                                <div
                                  key={n.id}
                                  className={`px-4 py-3 border-b border-dark-700 last:border-0 ${!n.is_read ? 'bg-dark-750' : ''}`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div className="mt-0.5 flex-shrink-0">{icon}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className={`text-xs font-semibold truncate ${!n.is_read ? 'text-gray-100' : 'text-gray-400'}`}>{n.title}</p>
                                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />}
                                      </div>
                                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                                      <p className="text-xs text-gray-600 mt-1">{date}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="lg:hidden p-1 text-gray-400 hover:text-gray-200"
                    aria-label="Close menu"
                  >
                    <X size={20} />
                  </button>
                </div>
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
                            setMobileMenuOpen(false);
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
                                  setMobileMenuOpen(false);
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
                        setMobileMenuOpen(false);
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
                        setMobileMenuOpen(false);
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

          <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-dark-950 lg:mt-0 mt-0">
            <Suspense fallback={<LoadingFallback />}>
              {activeTab === 'dashboard' && <OverzichtTabs />}
              {activeTab === 'tenants' && <TenantManagement />}
              {activeTab === 'spaces-spaces' && <SpaceManagement />}
              {activeTab === 'spaces-rates' && <SpaceTypeRates />}
              {activeTab === 'contracts' && <LeaseManagement />}
              {activeTab === 'bookings' && <MeetingRoomBookings />}
              {activeTab === 'flex-bookings' && <FlexWorkspaceBookings />}
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
              {activeTab === 'eboekhouden' && eBoekhoudenEnabled && <EBoekhoudenDashboard />}
              {activeTab === 'settings' && <VerhuurderTabs />}
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
