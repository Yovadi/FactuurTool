import { useState, useEffect, useRef } from 'react';
import { InvoiceManagement, InvoiceManagementRef } from './InvoiceManagement';
import { InvoiceOverview } from './InvoiceOverview';
import { DebtorsOverview } from './DebtorsOverview';
import { DepositOverview } from './DepositOverview';
import { FileText, AlertTriangle, FileCheck, ListChecks, Shield } from 'lucide-react';

export type DebiteurenTab = 'te-factureren' | 'facturen' | 'borg' | 'outstanding' | 'log';

type DebiteurenTabsProps = {
  initialTab?: DebiteurenTab;
  focusMonth?: string;
  onInitialTabConsumed?: () => void;
  onFocusMonthConsumed?: () => void;
  onCreateCreditNote?: (invoice: any, tenant: any, spaces: any[]) => void;
  isActive?: boolean;
};

export function DebiteurenTabs({
  initialTab,
  focusMonth,
  onInitialTabConsumed,
  onFocusMonthConsumed,
  onCreateCreditNote,
  isActive = true,
}: DebiteurenTabsProps) {
  const [activeTab, setActiveTab] = useState<DebiteurenTab>(initialTab || 'te-factureren');
  const invoiceManagementRef = useRef<InvoiceManagementRef>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      onInitialTabConsumed?.();
    }
  }, [initialTab]);

  const tabs: { id: DebiteurenTab; label: string; icon: any }[] = [
    { id: 'te-factureren', label: 'Te factureren', icon: ListChecks },
    { id: 'facturen', label: 'Facturen', icon: FileText },
    { id: 'borg', label: 'Borg', icon: Shield },
    { id: 'outstanding', label: 'Openstaand', icon: AlertTriangle },
    { id: 'log', label: 'Logboek', icon: FileCheck },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-4">
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
          <div className="flex gap-2 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gold-500 text-white'
                      : 'text-gray-300 hover:bg-dark-800'
                  }`}
                >
                  <tab.icon size={20} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'te-factureren' && (
          <div className="h-full flex flex-col overflow-hidden gap-4">
            <div className="flex-shrink-0 max-h-[45%] overflow-y-auto">
              <InvoiceOverview
                isActive={isActive && activeTab === 'te-factureren'}
                focusMonth={focusMonth}
                onFocusMonthConsumed={onFocusMonthConsumed}
                onInvoicesCreated={() => invoiceManagementRef.current?.refreshInvoices()}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <InvoiceManagement
                ref={invoiceManagementRef}
                onCreateCreditNote={onCreateCreditNote}
                invoiceTypeFilter="all"
                hideOpenInvoices
                embeddedDrafts
                isActive={isActive && activeTab === 'te-factureren'}
              />
            </div>
          </div>
        )}
        {activeTab === 'facturen' && (
          <div className="h-full overflow-hidden">
            <InvoiceManagement
              onCreateCreditNote={onCreateCreditNote}
              invoiceTypeFilter="all"
              hideOpenInvoices
              isActive={isActive && activeTab === 'facturen'}
            />
          </div>
        )}
        {activeTab === 'borg' && (
          <div className="h-full overflow-y-auto">
            <DepositOverview isActive={isActive && activeTab === 'borg'} />
          </div>
        )}
        {activeTab === 'outstanding' && (
          <div className="h-full overflow-hidden">
            <InvoiceManagement
              onCreateCreditNote={onCreateCreditNote}
              invoiceTypeFilter="all"
              onlyOpenInvoices
              isActive={isActive && activeTab === 'outstanding'}
            />
          </div>
        )}
        {activeTab === 'log' && <DebtorsOverview initialTab="log" />}
      </div>
    </div>
  );
}
