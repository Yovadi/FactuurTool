import { useState } from 'react';
import { InvoiceManagement } from './InvoiceManagement';
import { DebtorsOverview } from './DebtorsOverview';
import { CreditNotes } from './CreditNotes';
import { CreditOverview } from './CreditOverview';
import { Analytics } from './Analytics';
import { FileText, AlertTriangle, Receipt, TrendingUp, DollarSign } from 'lucide-react';

type FinancialTab = 'invoices' | 'debtors' | 'creditnotes' | 'creditoverview' | 'analytics';

export function Financial() {
  const [activeTab, setActiveTab] = useState<FinancialTab>('invoices');

  const tabs = [
    { id: 'invoices' as FinancialTab, label: 'Facturen', icon: FileText },
    { id: 'debtors' as FinancialTab, label: 'Debiteuren', icon: AlertTriangle },
    { id: 'creditnotes' as FinancialTab, label: 'Credit Nota\'s', icon: Receipt },
    { id: 'creditoverview' as FinancialTab, label: 'Credit Overzicht', icon: DollarSign },
    { id: 'analytics' as FinancialTab, label: 'Analyses', icon: TrendingUp },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Financieel</h2>
        <div className="bg-dark-800 rounded-lg p-3 inline-flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 font-medium rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-gold-500 text-white'
                    : 'text-gray-400 hover:bg-dark-700 hover:text-gray-300'
                }`}
              >
                <Icon size={20} />
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
        {activeTab === 'creditoverview' && <CreditOverview />}
        {activeTab === 'analytics' && <Analytics />}
      </div>
    </div>
  );
}
