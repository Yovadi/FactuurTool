import { useState, useRef } from 'react';
import { InvoiceManagement } from './InvoiceManagement';
import { DebtorsOverview } from './DebtorsOverview';
import { FileText, AlertTriangle, FileCheck, Plus } from 'lucide-react';

type PrefilledInvoiceData = {
  invoice: any;
  tenant: any;
  spaces: any[];
};

type DebiteurenTabsProps = {
  onCreateCreditNote?: (invoice: any, tenant: any, spaces: any[]) => void;
};

export function DebiteurenTabs({ onCreateCreditNote }: DebiteurenTabsProps) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'outstanding' | 'log'>('invoices');
  const invoiceManagementRef = useRef<any>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Debiteuren</h2>
      </div>

      <div className="flex-shrink-0 mb-4">
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
          <div className="flex gap-2 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('invoices')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'invoices'
                    ? 'bg-gold-500 text-dark-950'
                    : 'text-gray-300 hover:bg-dark-800'
                }`}
              >
                <FileText size={20} />
                Facturen
              </button>
              <button
                onClick={() => setActiveTab('outstanding')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'outstanding'
                    ? 'bg-gold-500 text-dark-950'
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
                    ? 'bg-gold-500 text-dark-950'
                    : 'text-gray-300 hover:bg-dark-800'
                }`}
              >
                <FileCheck size={20} />
                Logboek
              </button>
            </div>
            {activeTab === 'invoices' && (
              <button
                onClick={() => invoiceManagementRef.current?.openGenerateModal()}
                className="flex items-center gap-2 px-4 py-2 bg-gold-500 text-dark-900 font-medium rounded-lg hover:bg-gold-400 transition-colors"
              >
                <Plus size={18} />
                Genereer Facturen
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'invoices' && <InvoiceManagement ref={invoiceManagementRef} onCreateCreditNote={onCreateCreditNote} />}
        {activeTab === 'outstanding' && <DebtorsOverview initialTab="open" />}
        {activeTab === 'log' && <DebtorsOverview initialTab="log" />}
      </div>
    </div>
  );
}
