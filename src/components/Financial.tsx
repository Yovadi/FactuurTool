import { useState } from 'react';
import { InvoiceManagement } from './InvoiceManagement';
import { DebtorsOverview } from './DebtorsOverview';
import { CreditNotes } from './CreditNotes';
import { Analytics } from './Analytics';
import { FileText, AlertTriangle, Receipt, TrendingUp } from 'lucide-react';

type FinancialTab = 'invoices' | 'debtors' | 'creditnotes' | 'analytics';

export function Financial() {
  const [activeTab, setActiveTab] = useState<FinancialTab>('invoices');

  const tabs = [
    { id: 'invoices' as FinancialTab, label: 'Facturen', icon: FileText },
    { id: 'debtors' as FinancialTab, label: 'Debiteuren', icon: AlertTriangle },
    { id: 'creditnotes' as FinancialTab, label: 'Credit Nota\'s', icon: Receipt },
    { id: 'analytics' as FinancialTab, label: 'Analyses', icon: TrendingUp },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Financieel</h2>
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gold-500 text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {activeTab === 'invoices' && <InvoiceManagement />}
        {activeTab === 'debtors' && <DebtorsOverview />}
        {activeTab === 'creditnotes' && <CreditNotes />}
        {activeTab === 'analytics' && <Analytics />}
      </div>
    </div>
  );
}
