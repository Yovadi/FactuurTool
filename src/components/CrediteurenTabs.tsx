import { useState } from 'react';
import { CreditNotes } from './CreditNotes';
import { CreditOverview } from './CreditOverview';
import { Receipt, DollarSign } from 'lucide-react';

type PrefilledInvoiceData = {
  invoice: any;
  tenant: any;
  spaces: any[];
};

type CrediteurenTabsProps = {
  prefilledInvoiceData?: PrefilledInvoiceData | null;
  onClearPrefilled?: () => void;
};

export function CrediteurenTabs({ prefilledInvoiceData, onClearPrefilled }: CrediteurenTabsProps) {
  const [activeTab, setActiveTab] = useState<'creditnotes' | 'overview'>('creditnotes');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Crediteuren</h2>
      </div>

      <div className="sticky top-0 z-10 bg-dark-950 pb-2 mb-4">
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('creditnotes')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'creditnotes'
                  ? 'bg-gold-500 text-dark-950'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <Receipt size={20} />
              Credit Nota's
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-gold-500 text-dark-950'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <DollarSign size={20} />
              Credit Overzicht
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'creditnotes' && (
        <CreditNotes
          prefilledInvoiceData={prefilledInvoiceData}
          onClearPrefilled={onClearPrefilled}
        />
      )}
      {activeTab === 'overview' && <CreditOverview />}
    </div>
  );
}
