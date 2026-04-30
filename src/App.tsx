import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { UpdateDialog } from './components/UpdateDialog';
import { LayoutDashboard, Users, Building, Settings, CalendarClock, FileText, Building2, Calculator, Euro, UserCheck, UserMinus, Loader2, Menu, X, Database, Mail, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from './lib/supabase';
import { syncInvoicePDFs, syncLeaseContractPDFs, syncCreditNotePDFs, startPeriodicSync, type SyncResult } from './utils/invoicePdfSync';
import { getEffectiveRootFolderPath } from './utils/localSettings';

const OverzichtTabs = lazy(() => import('./components/OverzichtTabs').then(m => ({ default: m.OverzichtTabs })));
const TenantManagement = lazy(() => import('./components/TenantManagement').then(m => ({ default: m.TenantManagement })));
const LeaseManagement = lazy(() => import('./components/LeaseManagement').then(m => ({ default: m.LeaseManagement })));
const SpaceManagement = lazy(() => import('./components/SpaceManagement').then(m => ({ default: m.SpaceManagement })));
const SpaceTypeRates = lazy(() => import('./components/SpaceTypeRates').then(m => ({ default: m.SpaceTypeRates })));
const VerhuurderTabs = lazy(() => import('./components/VerhuurderTabs').then(m => ({ default: m.VerhuurderTabs })));
const InstellingenTabs = lazy(() => import('./components/InstellingenTabs').then(m => ({ default: m.InstellingenTabs })));
const MeetingRoomBookings = lazy(() => import('./components/MeetingRoomBookings').then(m => ({ default: m.MeetingRoomBookings })));
const DebiteurenTabs = lazy(() => import('./components/DebiteurenTabs').then(m => ({ default: m.DebiteurenTabs })));
const CrediteurenTabs = lazy(() => import('./components/CrediteurenTabs').then(m => ({ default: m.CrediteurenTabs })));
const EBoekhoudenDashboard = lazy(() => import('./components/EBoekhoudenDashboard').then(m => ({ default: m.EBoekhoudenDashboard })));
const EmailTab = lazy(() => import('./components/EmailTab').then(m => ({ default: m.EmailTab })));

type Tab = 'dashboard' | 'tenants' | 'spaces-spaces' | 'spaces-rates' | 'contracts' | 'bookings' | 'financial-debtors' | 'financial-creditors' | 'eboekhouden' | 'email' | 'verhuurder' | 'settings';

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
  const [debiteurenInitialTab, setDebiteurenInitialTab] = useState<'facturen' | 'outstanding' | 'log' | undefined>(undefined);
  const [appVersion, setAppVersion] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [eBoekhoudenEnabled, setEBoekhoudenEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [updateDialog, setUpdateDialog] = useState<UpdateDialogState>({
    show: false,
    type: 'update-not-available'
  });
  const [syncStatus, setSyncStatus] = useState<{
    active: boolean;
    current: number;
    total: number;
    invoiceNumber: string;
    phase?: 'invoices' | 'credit_notes' | 'leases';
    result?: { synced: number; failed: number; errors: string[]; leaseSynced?: number; leaseFailed?: number } | null;
  }>({ active: false, current: 0, total: 0, invoiceNumber: '' });
  const [newInvoiceCount, setNewInvoiceCount] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(['dashboard']));

  useEffect(() => {
    const isElectronApp = !!(window as any).electronAPI;
    setIsElectron(isElectronApp);

    if ((window as any).electron?.getAppVersion) {
      (window as any).electron.getAppVersion().then((version: string) => {
        setAppVersion(version);
      }).catch(() => {});
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

    const timers: ReturnType<typeof setTimeout>[] = [];

    let stopPeriodicSync: (() => void) | null = null;

    if (isElectronApp) {
      timers.push(setTimeout(() => {
        syncFolders().then(() => runFullSync());
      }, 1000));

      stopPeriodicSync = startPeriodicSync(
        undefined,
        (current, total, label) => {
          setSyncStatus({ active: true, current, total, invoiceNumber: label, phase: 'invoices' });
        },
        (current, total, label) => {
          setSyncStatus({ active: true, current, total, invoiceNumber: label, phase: 'leases' });
        },
        (invoiceResult, leaseResult) => {
          const totalSynced = (invoiceResult?.synced || 0) + (leaseResult?.synced || 0);
          const totalFailed = (invoiceResult?.failed || 0) + (leaseResult?.failed || 0);
          const allErrors = [...(invoiceResult?.errors || []), ...(leaseResult?.errors || [])];
          setSyncStatus({
            active: false,
            current: totalSynced,
            total: totalSynced + totalFailed,
            invoiceNumber: '',
            result: {
              synced: invoiceResult?.synced || 0,
              failed: invoiceResult?.failed || 0,
              errors: allErrors,
              leaseSynced: leaseResult?.synced || 0,
              leaseFailed: leaseResult?.failed || 0,
            },
          });
          setTimeout(() => {
            setSyncStatus(prev => prev.result ? { ...prev, result: null } : prev);
          }, 8000);
        },
        5 * 60 * 1000
      );
    }

    timers.push(setTimeout(() => {
      setIsInitialized(true);
    }, 100));

    supabase
      .from('company_settings')
      .select('eboekhouden_enabled, smtp_enabled, smtp_connected, graph_enabled, graph_connected, resend_enabled, resend_connected')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.eboekhouden_enabled) setEBoekhoudenEnabled(true);
        const hasEmail = data?.smtp_enabled ||
          data?.graph_enabled ||
          data?.resend_enabled;
        if (hasEmail) setEmailEnabled(true);
      });

    const handleEboekhoudenChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEBoekhoudenEnabled(detail.enabled);
      if (!detail.enabled) {
        setActiveTab(prev => {
          if (prev === 'eboekhouden') {
            setVisitedTabs(v => { const n = new Set(v); n.add('settings'); return n; });
            return 'settings';
          }
          return prev;
        });
      }
    };
    window.addEventListener('eboekhouden-enabled-changed', handleEboekhoudenChange);

    const handleEmailChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEmailEnabled(detail.enabled);
      if (!detail.enabled) {
        setActiveTab(prev => {
          if (prev === 'email') {
            setVisitedTabs(v => { const n = new Set(v); n.add('settings'); return n; });
            return 'settings';
          }
          return prev;
        });
      }
    };
    window.addEventListener('email-enabled-changed', handleEmailChange);

    checkNewInvoices();
    const invoiceCheckInterval = setInterval(checkNewInvoices, 30000);
    const handleInvoicesSeen = () => setNewInvoiceCount(0);
    window.addEventListener('invoices-seen', handleInvoicesSeen);

    return () => {
      timers.forEach(clearTimeout);
      stopPeriodicSync?.();
      window.removeEventListener('eboekhouden-enabled-changed', handleEboekhoudenChange);
      window.removeEventListener('email-enabled-changed', handleEmailChange);
      clearInterval(invoiceCheckInterval);
      window.removeEventListener('invoices-seen', handleInvoicesSeen);
    };
  }, []);

  const checkNewInvoices = async () => {
    const lastSeen = localStorage.getItem('hal5-invoices-last-seen');
    if (!lastSeen) {
      localStorage.setItem('hal5-invoices-last-seen', new Date().toISOString());
      setNewInvoiceCount(0);
      return;
    }
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', lastSeen);
    setNewInvoiceCount(count ?? 0);
  };

  const syncFolders = async () => {
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('root_folder_path')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const rootPath = await getEffectiveRootFolderPath(settings?.root_folder_path);
      if (!rootPath) return;
      if (!(window as any).electronAPI?.createTenantFolder) return;

      const [{ data: tenants }, { data: externalCustomers }] = await Promise.all([
        supabase.from('tenants').select('company_name'),
        supabase.from('external_customers').select('company_name'),
      ]);

      const createFolder = (window as any).electronAPI.createTenantFolder;
      await Promise.all([
        ...(tenants || []).map(t => createFolder(rootPath, t.company_name, 'Huurders')),
        ...(externalCustomers || []).map(c => createFolder(rootPath, c.company_name, 'Externe huurders')),
      ]);
    } catch {
    }
  };

  const runFullSync = async () => {
    try {
      setSyncStatus({ active: true, current: 0, total: 0, invoiceNumber: '', phase: 'invoices' });

      const invoiceResult = await syncInvoicePDFs((current, total, label) => {
        setSyncStatus({ active: true, current, total, invoiceNumber: label, phase: 'invoices' });
      });

      setSyncStatus(prev => ({ ...prev, phase: 'credit_notes', current: 0, total: 0, invoiceNumber: '' }));

      const creditNoteResult = await syncCreditNotePDFs((current, total, label) => {
        setSyncStatus({ active: true, current, total, invoiceNumber: label, phase: 'credit_notes' });
      });

      setSyncStatus(prev => ({ ...prev, phase: 'leases', current: 0, total: 0, invoiceNumber: '' }));

      const leaseResult = await syncLeaseContractPDFs((current, total, label) => {
        setSyncStatus({ active: true, current, total, invoiceNumber: label, phase: 'leases' });
      });

      const totalSynced = (invoiceResult?.synced || 0) + (creditNoteResult?.synced || 0) + (leaseResult?.synced || 0);
      const totalFailed = (invoiceResult?.failed || 0) + (creditNoteResult?.failed || 0) + (leaseResult?.failed || 0);

      if (totalSynced === 0 && totalFailed === 0) {
        setSyncStatus(prev => ({ ...prev, active: false }));
        return;
      }

      const allErrors = [
        ...(invoiceResult?.errors || []),
        ...(creditNoteResult?.errors || []),
        ...(leaseResult?.errors || []),
      ];

      setSyncStatus({
        active: false,
        current: totalSynced,
        total: totalSynced + totalFailed,
        invoiceNumber: '',
        result: {
          synced: (invoiceResult?.synced || 0) + (creditNoteResult?.synced || 0),
          failed: (invoiceResult?.failed || 0) + (creditNoteResult?.failed || 0),
          errors: allErrors,
          leaseSynced: leaseResult?.synced || 0,
          leaseFailed: leaseResult?.failed || 0,
        },
      });

      const hasErrors = totalFailed > 0;
      setTimeout(() => {
        setSyncStatus(prev => prev.result ? { ...prev, result: null } : prev);
      }, hasErrors ? 15000 : 8000);
    } catch {
      setSyncStatus(prev => ({ ...prev, active: false }));
    }
  };

  const switchTab = useCallback((tab: Tab) => {
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    setActiveTab(tab);
  }, []);

  const tabStyle = (tab: Tab): React.CSSProperties =>
    activeTab === tab ? {} : { display: 'none' };

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
    ...(emailEnabled ? [{ id: 'email', label: 'E-mail', icon: Mail }] : []),
    { id: 'verhuurder', label: 'Verhuurder', icon: Building2 },
  ] as MenuSection[];

  const bottomNavigation: MenuSection[] = [
    { id: 'settings', label: 'Instellingen', icon: Settings },
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
      {(syncStatus.active || syncStatus.result) && (
        <div className="fixed bottom-4 right-4 z-[100] max-w-sm">
          {syncStatus.active && (
            <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl px-4 py-3">
              <div className="flex items-center gap-3">
                <RefreshCw size={18} className="text-gold-500 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100">
                    {syncStatus.phase === 'leases' ? 'Huurcontracten synchroniseren...' : syncStatus.phase === 'credit_notes' ? 'Credit facturen synchroniseren...' : 'Factuur-PDF\'s synchroniseren...'}
                  </p>
                  {syncStatus.total > 0 && (
                    <>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{syncStatus.invoiceNumber} ({syncStatus.current}/{syncStatus.total})</p>
                      <div className="w-full bg-dark-700 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-gold-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${(syncStatus.current / syncStatus.total) * 100}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          {syncStatus.result && (
            <div className={`bg-dark-800 border rounded-xl shadow-2xl px-4 py-3 ${(syncStatus.result.failed > 0 || (syncStatus.result.leaseFailed || 0) > 0) ? 'border-amber-600/50' : 'border-green-600/50'}`}>
              <div className="flex items-start gap-3">
                <CheckCircle size={18} className={`flex-shrink-0 mt-0.5 ${(syncStatus.result.failed > 0 || (syncStatus.result.leaseFailed || 0) > 0) ? 'text-amber-400' : 'text-green-400'}`} />
                <div className="flex-1 min-w-0">
                  {syncStatus.result.synced > 0 && (
                    <p className="text-sm font-medium text-gray-100">
                      {syncStatus.result.synced} factuur-PDF{syncStatus.result.synced !== 1 ? "'s" : ''} gesynchroniseerd
                    </p>
                  )}
                  {(syncStatus.result.leaseSynced || 0) > 0 && (
                    <p className="text-sm font-medium text-gray-100">
                      {syncStatus.result.leaseSynced} huurcontract{syncStatus.result.leaseSynced !== 1 ? 'en' : ''} gesynchroniseerd
                    </p>
                  )}
                  {(syncStatus.result.failed > 0 || (syncStatus.result.leaseFailed || 0) > 0) && (
                    <>
                      <p className="text-xs text-amber-400 mt-0.5">{syncStatus.result.failed + (syncStatus.result.leaseFailed || 0)} mislukt</p>
                      {syncStatus.result.errors && syncStatus.result.errors.length > 0 && (
                        <div className="mt-1 max-h-20 overflow-y-auto">
                          {syncStatus.result.errors.slice(0, 3).map((err, idx) => (
                            <p key={idx} className="text-xs text-gray-400 truncate">{err}</p>
                          ))}
                          {syncStatus.result.errors.length > 3 && (
                            <p className="text-xs text-gray-500">en {syncStatus.result.errors.length - 3} meer...</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={() => setSyncStatus(prev => ({ ...prev, result: null }))}
                  className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
            <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2 flex flex-col flex-shrink-0 h-full overflow-hidden">
              <div className="px-4 py-3 mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gold-500">HAL5 Facturatie</h2>
                  <p className="text-sm text-gray-400 mt-1">Beheer systeem</p>
                  {appVersion && (
                    <p className="text-xs text-gray-500 mt-1">Versie {appVersion}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isElectron && (
                    <button
                      onClick={() => {
                        if (!syncStatus.active) {
                          syncFolders().then(() => runFullSync());
                        }
                      }}
                      disabled={syncStatus.active}
                      className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded-lg hover:bg-dark-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="PDF's synchroniseren"
                    >
                      <RefreshCw size={18} className={syncStatus.active ? 'animate-spin text-gold-500' : ''} />
                    </button>
                  )}
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="lg:hidden p-1 text-gray-400 hover:text-gray-200"
                    aria-label="Close menu"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <nav className="flex-1 overflow-y-auto space-y-1 pb-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActiveTab(item.id, item.children);

                  if (item.children) {
                    const showInvoiceBadge = item.id === 'financial' && newInvoiceCount > 0;
                    return (
                      <div key={item.id}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            switchTab(item.children![0].id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                            isActive ? 'text-gold-500 hover:text-gold-400' : 'text-gray-100 hover:text-white'
                          }`}>
                          <Icon size={20} />
                          {item.label}
                          {showInvoiceBadge && (
                            <span className="ml-auto bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                              {newInvoiceCount > 99 ? '99+' : newInvoiceCount}
                            </span>
                          )}
                        </button>
                        <div className="ml-4 mt-1 space-y-1">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            const isChildActive = activeTab === child.id;
                            const showChildBadge = child.id === 'financial-debtors' && newInvoiceCount > 0;
                            return (
                              <button
                                key={child.id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  switchTab(child.id);
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
                                {showChildBadge && (
                                  <span className={`ml-auto text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                                    isChildActive ? 'bg-dark-950 text-gold-500' : 'bg-blue-500 text-white'
                                  }`}>
                                    {newInvoiceCount > 99 ? '99+' : newInvoiceCount}
                                  </span>
                                )}
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
                        switchTab(item.id as Tab);
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

              <div className="flex-shrink-0 border-t border-dark-700 pt-2 pb-1">
                {bottomNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={(e) => {
                        e.preventDefault();
                        switchTab(item.id as Tab);
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
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-dark-950 lg:mt-0 mt-0">
            <Suspense fallback={<LoadingFallback />}>
              <div className="h-full" style={tabStyle('dashboard')}>
                {visitedTabs.has('dashboard') && <OverzichtTabs onNavigateToDebtors={(subTab) => {
                  setDebiteurenInitialTab(subTab);
                  switchTab('financial-debtors');
                }} onNavigateToInvoicing={() => {
                  switchTab('financial-debtors');
                }} />}
              </div>
              <div className="h-full" style={tabStyle('tenants')}>
                {visitedTabs.has('tenants') && <TenantManagement />}
              </div>
              <div className="h-full" style={tabStyle('spaces-spaces')}>
                {visitedTabs.has('spaces-spaces') && <SpaceManagement />}
              </div>
              <div className="h-full" style={tabStyle('spaces-rates')}>
                {visitedTabs.has('spaces-rates') && <SpaceTypeRates />}
              </div>
              <div className="h-full" style={tabStyle('contracts')}>
                {visitedTabs.has('contracts') && <LeaseManagement />}
              </div>
              <div className="h-full" style={tabStyle('bookings')}>
                {visitedTabs.has('bookings') && <MeetingRoomBookings />}
              </div>
              <div className="h-full" style={tabStyle('financial-debtors')}>
                {visitedTabs.has('financial-debtors') && (
                  <DebiteurenTabs
                    initialTab={debiteurenInitialTab}
                    onInitialTabConsumed={() => setDebiteurenInitialTab(undefined)}
                    onCreateCreditNote={(invoice, tenant, spaces) => {
                      setPrefilledInvoiceData({ invoice, tenant, spaces });
                      switchTab('financial-creditors');
                    }}
                  />
                )}
              </div>
              <div className="h-full" style={tabStyle('financial-creditors')}>
                {visitedTabs.has('financial-creditors') && (
                  <CrediteurenTabs
                    prefilledInvoiceData={prefilledInvoiceData}
                    onClearPrefilled={() => setPrefilledInvoiceData(null)}
                  />
                )}
              </div>
              <div className="h-full" style={tabStyle('eboekhouden')}>
                {visitedTabs.has('eboekhouden') && eBoekhoudenEnabled && <EBoekhoudenDashboard />}
              </div>
              <div className="h-full" style={tabStyle('email')}>
                {visitedTabs.has('email') && emailEnabled && (
                  <EmailTab
                    onOpenInSplitscreen={() => {
                      const electron = (window as any).electron;
                      if (electron?.openPreviewWindow) {
                        electron.openPreviewWindow({ type: 'email', props: {} });
                      }
                    }}
                    onNavigateToIntegrations={() => switchTab('settings')}
                  />
                )}
              </div>
              <div className="h-full" style={tabStyle('verhuurder')}>
                {visitedTabs.has('verhuurder') && <VerhuurderTabs />}
              </div>
              <div className="h-full" style={tabStyle('settings')}>
                {visitedTabs.has('settings') && <InstellingenTabs />}
              </div>
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
