import { useState, useRef } from 'react';
import { InvoiceManagement, InvoiceManagementRef } from './InvoiceManagement';
import { DebtorsOverview } from './DebtorsOverview';
import { FileText, AlertTriangle, FileCheck, Plus } from 'lucide-react';

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
      <div className="flex-shrink-0 mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Debiteuren</h2>
      </div>

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
              <button
                onClick={() => invoiceManagementRef.current?.openGenerateModal()}
                className="flex items-center gap-2 px-4 py-2 bg-gold-500 text-white font-medium rounded-lg hover:bg-gold-400 transition-colors"
              >
                <Plus size={18} />
                Genereer Facturen
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'facturen' && (
          <InvoiceManagement
            ref={invoiceManagementRef}
            onCreateCreditNote={onCreateCreditNote}
            invoiceTypeFilter="all"
          />
        )}
        {activeTab === 'outstanding' && <DebtorsOverview initialTab="open" />}
        {activeTab === 'log' && <DebtorsOverview initialTab="log" />}
      </div>
    </div>
  );
}
