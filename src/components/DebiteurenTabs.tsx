import { useState } from 'react';
import { InvoiceManagement } from './InvoiceManagement';
import { DebtorsOverview } from './DebtorsOverview';
import { FileText, AlertTriangle, FileCheck } from 'lucide-react';

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

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Debiteuren</h2>
      </div>

      <div className="sticky top-0 z-10 bg-dark-950 pb-2 mb-4">
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
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
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'invoices' && <InvoiceManagement onCreateCreditNote={onCreateCreditNote} />}
        {activeTab === 'outstanding' && <DebtorsOverview initialTab="open" />}
        {activeTab === 'log' && <DebtorsOverview initialTab="log" />}
      </div>
    </div>
  );
}
