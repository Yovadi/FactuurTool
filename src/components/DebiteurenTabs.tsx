import { useState, useRef } from 'react';
import { InvoiceManagement, InvoiceManagementRef } from './InvoiceManagement';
import { InvoiceOverview } from './InvoiceOverview';
import { DebtorsOverview } from './DebtorsOverview';
import { FileText, AlertTriangle, FileCheck, Home, Calendar } from 'lucide-react';

type DebiteurenTabsProps = {
  onCreateCreditNote?: (invoice: any, tenant: any, spaces: any[]) => void;
};

export function DebiteurenTabs({ onCreateCreditNote }: DebiteurenTabsProps) {
  const [activeTab, setActiveTab] = useState<'facturen' | 'outstanding' | 'log'>('facturen');
  const invoiceManagementRef = useRef<InvoiceManagementRef>(null);

  const tabs: { id: typeof activeTab; label: string; icon: any }[] = [
    { id: 'facturen', label: 'Facturen', icon: FileText },
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
            {activeTab === 'facturen' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => invoiceManagementRef.current?.openGenerateHuurModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-500 transition-colors"
                >
                  <Home size={18} />
                  Huur Facturen
                </button>
                <button
                  onClick={() => invoiceManagementRef.current?.openGenerateBookingsModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors"
                >
                  <Calendar size={18} />
                  Boeking Facturen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'facturen' && (
          <div className="h-full flex flex-col gap-4 overflow-y-auto">
            <InvoiceOverview />
            <InvoiceManagement
              ref={invoiceManagementRef}
              onCreateCreditNote={onCreateCreditNote}
              invoiceTypeFilter="all"
            />
          </div>
        )}
        {activeTab === 'outstanding' && <DebtorsOverview initialTab="open" />}
        {activeTab === 'log' && <DebtorsOverview initialTab="log" />}
      </div>
    </div>
  );
}
