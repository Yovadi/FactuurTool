import { useState } from 'react';
import { InvoiceManagement } from './InvoiceManagement';
import { DebtorsOverview } from './DebtorsOverview';
import { CreditNotes } from './CreditNotes';
import { CreditOverview } from './CreditOverview';
import { FileText, AlertTriangle, Receipt, DollarSign } from 'lucide-react';

export function FinancialTabs() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'debtors' | 'creditnotes' | 'creditoverview'>('invoices');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Facturatie Beheer</h2>
      </div>

      <div className="flex gap-2 mb-6 border-b border-dark-700">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'invoices'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <FileText size={20} />
          Facturen
        </button>
        <button
          onClick={() => setActiveTab('debtors')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'debtors'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <AlertTriangle size={20} />
          Debiteuren
        </button>
        <button
          onClick={() => setActiveTab('creditnotes')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'creditnotes'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Receipt size={20} />
          Credit Nota's
        </button>
        <button
          onClick={() => setActiveTab('creditoverview')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
            activeTab === 'creditoverview'
              ? 'text-gold-500 border-b-2 border-gold-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <DollarSign size={20} />
          Credit Overzicht
        </button>
      </div>

      {activeTab === 'invoices' && <InvoiceManagement />}
      {activeTab === 'debtors' && <DebtorsOverview />}
      {activeTab === 'creditnotes' && <CreditNotes />}
      {activeTab === 'creditoverview' && <CreditOverview />}
    </div>
  );
}
