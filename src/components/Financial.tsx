import { useState } from 'react';
import { InvoiceManagement } from './InvoiceManagement';
import { DebtorsOverview } from './DebtorsOverview';
import { CreditNotes } from './CreditNotes';
import { CreditOverview } from './CreditOverview';
import { FileText, AlertTriangle, Receipt, DollarSign, UserCheck, UserMinus } from 'lucide-react';

type MainTab = 'debtors' | 'creditors';
type DebtorSubTab = 'invoices' | 'outstanding' | 'log';
type CreditorSubTab = 'creditnotes' | 'overview';

type PrefilledInvoiceData = {
  invoice: any;
  tenant: any;
  spaces: any[];
};

export function Financial() {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('debtors');
  const [activeDebtorSubTab, setActiveDebtorSubTab] = useState<DebtorSubTab>('invoices');
  const [activeCreditorSubTab, setActiveCreditorSubTab] = useState<CreditorSubTab>('creditnotes');
  const [prefilledInvoiceData, setPrefilledInvoiceData] = useState<PrefilledInvoiceData | null>(null);

  const mainTabs = [
    { id: 'debtors' as MainTab, label: 'Debiteuren', icon: UserCheck },
    { id: 'creditors' as MainTab, label: 'Crediteuren', icon: UserMinus },
  ];

  const debtorSubTabs = [
    { id: 'invoices' as DebtorSubTab, label: 'Facturen', icon: FileText },
    { id: 'outstanding' as DebtorSubTab, label: 'Openstaand', icon: AlertTriangle },
    { id: 'log' as DebtorSubTab, label: 'Logboek', icon: FileText },
  ];

  const creditorSubTabs = [
    { id: 'creditnotes' as CreditorSubTab, label: 'Credit Nota\'s', icon: Receipt },
    { id: 'overview' as CreditorSubTab, label: 'Credit Overzicht', icon: DollarSign },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Facturatie</h2>
        <div className="flex gap-2 border-b border-dark-700">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMainTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 ${
                  activeMainTab === tab.id
                    ? 'text-gold-500 border-gold-500'
                    : 'text-gray-400 border-transparent hover:text-gray-300'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeMainTab === 'debtors' && (
        <div className="mb-6">
          <div className="flex gap-2 border-b border-dark-700">
            {debtorSubTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDebtorSubTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all border-b-2 ${
                    activeDebtorSubTab === tab.id
                      ? 'text-gold-500 border-gold-500'
                      : 'text-gray-400 border-transparent hover:text-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeMainTab === 'creditors' && (
        <div className="mb-6">
          <div className="flex gap-2 border-b border-dark-700">
            {creditorSubTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCreditorSubTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all border-b-2 ${
                    activeCreditorSubTab === tab.id
                      ? 'text-gold-500 border-gold-500'
                      : 'text-gray-400 border-transparent hover:text-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        {activeMainTab === 'debtors' && activeDebtorSubTab === 'invoices' && (
          <InvoiceManagement
            onCreateCreditNote={(invoice, tenant, spaces) => {
              setPrefilledInvoiceData({ invoice, tenant, spaces });
              setActiveMainTab('creditors');
              setActiveCreditorSubTab('creditnotes');
            }}
          />
        )}
        {activeMainTab === 'debtors' && activeDebtorSubTab === 'outstanding' && (
          <DebtorsOverview initialTab="open" />
        )}
        {activeMainTab === 'debtors' && activeDebtorSubTab === 'log' && (
          <DebtorsOverview initialTab="log" />
        )}
        {activeMainTab === 'creditors' && activeCreditorSubTab === 'creditnotes' && (
          <CreditNotes
            prefilledInvoiceData={prefilledInvoiceData}
            onClearPrefilled={() => setPrefilledInvoiceData(null)}
          />
        )}
        {activeMainTab === 'creditors' && activeCreditorSubTab === 'overview' && (
          <CreditOverview />
        )}
      </div>
    </div>
  );
}
