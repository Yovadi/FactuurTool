import { useState, useRef } from 'react';
import { InvoiceManagement, InvoiceTypeFilter, InvoiceManagementRef } from './InvoiceManagement';
import { DebtorsOverview } from './DebtorsOverview';
import { FileText, AlertTriangle, FileCheck, Plus, Home, Calendar, Zap, PenTool, Database } from 'lucide-react';

type PrefilledInvoiceData = {
  invoice: any;
  tenant: any;
  spaces: any[];
};

type DebiteurenTabsProps = {
  onCreateCreditNote?: (invoice: any, tenant: any, spaces: any[]) => void;
};

export function DebiteurenTabs({ onCreateCreditNote }: DebiteurenTabsProps) {
  const [activeTab, setActiveTab] = useState<'huur' | 'vergaderruimte' | 'flex' | 'handmatig' | 'outstanding' | 'log' | 'sync'>('huur');
  const invoiceManagementRef = useRef<InvoiceManagementRef>(null);

  const invoiceSubTabs: { id: InvoiceTypeFilter; label: string; icon: any }[] = [
    { id: 'huur', label: 'Huur', icon: Home },
    { id: 'vergaderruimte', label: 'Vergaderruimte', icon: Calendar },
    { id: 'flex', label: 'Flex', icon: Zap },
    { id: 'handmatig', label: 'Handmatig', icon: PenTool },
  ];

  const isInvoiceTab = ['huur', 'vergaderruimte', 'flex', 'handmatig'].includes(activeTab);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Debiteuren</h2>
      </div>

      <div className="flex-shrink-0 mb-4">
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
          <div className="flex gap-2 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {invoiceSubTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
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
              <div className="w-px bg-dark-600 mx-1" />
              <button
                onClick={() => setActiveTab('outstanding')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'outstanding'
                    ? 'bg-gold-500 text-white'
                    : 'text-gray-300 hover:bg-dark-800'
                }`}
              >
                <AlertTriangle size={20} />
                Openstaand
              </button>
              <button
                onClick={() => setActiveTab('log')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'log'
                    ? 'bg-gold-500 text-white'
                    : 'text-gray-300 hover:bg-dark-800'
                }`}
              >
                <FileCheck size={20} />
                Logboek
              </button>
              <button
                onClick={() => setActiveTab('sync')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'sync'
                    ? 'bg-gold-500 text-white'
                    : 'text-gray-300 hover:bg-dark-800'
                }`}
              >
                <Database size={20} />
                e-Boekhouden
              </button>
            </div>
            {isInvoiceTab && (
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
        {isInvoiceTab && (
          <InvoiceManagement
            ref={invoiceManagementRef}
            onCreateCreditNote={onCreateCreditNote}
            invoiceTypeFilter={activeTab as InvoiceTypeFilter}
          />
        )}
        {activeTab === 'outstanding' && <DebtorsOverview initialTab="open" />}
        {activeTab === 'log' && <DebtorsOverview initialTab="log" />}
        {activeTab === 'sync' && <DebtorsOverview initialTab="sync" />}
      </div>
    </div>
  );
}
