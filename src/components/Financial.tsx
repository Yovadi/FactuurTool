import { useState } from 'react';
import { InvoiceManagement } from './InvoiceManagement';
import { DebtorsOverview } from './DebtorsOverview';
import { CreditNotes } from './CreditNotes';
import { CreditOverview } from './CreditOverview';
import { Analytics } from './Analytics';
import { FileText, Receipt, TrendingUp } from 'lucide-react';

type FinancialTab = 'invoices' | 'credit' | 'analytics';

export function Financial() {
  const [activeTab, setActiveTab] = useState<FinancialTab>('invoices');
  const [invoiceSubTab, setInvoiceSubTab] = useState<'invoices' | 'debtors'>('invoices');
  const [creditSubTab, setCreditSubTab] = useState<'notes' | 'overview'>('notes');

  const tabs = [
    { id: 'invoices' as FinancialTab, label: 'Facturen & Debiteuren', icon: FileText },
    { id: 'credit' as FinancialTab, label: 'Credit Beheer', icon: Receipt },
    { id: 'analytics' as FinancialTab, label: 'Analyses', icon: TrendingUp },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Financieel</h2>
        <div className="flex gap-4 border-b border-dark-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'text-gold-500 border-b-2 border-gold-500'
                    : 'text-gray-400 hover:text-gray-300'
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
        {activeTab === 'invoices' && (
          <div>
            <div className="flex gap-4 mb-6 border-b border-dark-700">
              <button
                onClick={() => setInvoiceSubTab('invoices')}
                className={`px-4 py-3 font-semibold transition-colors ${
                  invoiceSubTab === 'invoices'
                    ? 'text-gold-500 border-b-2 border-gold-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Facturen
              </button>
              <button
                onClick={() => setInvoiceSubTab('debtors')}
                className={`px-4 py-3 font-semibold transition-colors ${
                  invoiceSubTab === 'debtors'
                    ? 'text-gold-500 border-b-2 border-gold-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Debiteuren
              </button>
            </div>
            {invoiceSubTab === 'invoices' ? <InvoiceManagement /> : <DebtorsOverview />}
          </div>
        )}
        {activeTab === 'credit' && (
          <div>
            <div className="flex gap-4 mb-6 border-b border-dark-700">
              <button
                onClick={() => setCreditSubTab('notes')}
                className={`px-4 py-3 font-semibold transition-colors ${
                  creditSubTab === 'notes'
                    ? 'text-gold-500 border-b-2 border-gold-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Credit Nota's
              </button>
              <button
                onClick={() => setCreditSubTab('overview')}
                className={`px-4 py-3 font-semibold transition-colors ${
                  creditSubTab === 'overview'
                    ? 'text-gold-500 border-b-2 border-gold-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Credit Overzicht
              </button>
            </div>
            {creditSubTab === 'notes' ? <CreditNotes /> : <CreditOverview />}
          </div>
        )}
        {activeTab === 'analytics' && <Analytics />}
      </div>
    </div>
  );
}
