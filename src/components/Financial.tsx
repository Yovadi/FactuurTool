import { useState } from 'react';
import { InvoiceManagement } from './InvoiceManagement';
import { DebtorsOverview } from './DebtorsOverview';
import { CreditNotes } from './CreditNotes';
import { CreditOverview } from './CreditOverview';
import { FileText, AlertTriangle, Receipt, DollarSign } from 'lucide-react';

type MainTab = 'invoices' | 'creditnotes';
type InvoiceSubTab = 'list' | 'outstanding' | 'log';
type CreditSubTab = 'list' | 'overview';

type PrefilledInvoiceData = {
  invoice: any;
  tenant: any;
  spaces: any[];
};

export function Financial() {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('invoices');
  const [activeInvoiceSubTab, setActiveInvoiceSubTab] = useState<InvoiceSubTab>('list');
  const [activeCreditSubTab, setActiveCreditSubTab] = useState<CreditSubTab>('list');
  const [prefilledInvoiceData, setPrefilledInvoiceData] = useState<PrefilledInvoiceData | null>(null);

  const mainTabs = [
    { id: 'invoices' as MainTab, label: 'Facturen', icon: FileText },
    { id: 'creditnotes' as MainTab, label: 'Credit Nota\'s', icon: Receipt },
  ];

  const invoiceSubTabs = [
    { id: 'list' as InvoiceSubTab, label: 'Facturen', icon: FileText },
    { id: 'outstanding' as InvoiceSubTab, label: 'Openstaand', icon: AlertTriangle },
    { id: 'log' as InvoiceSubTab, label: 'Logboek', icon: FileText },
  ];

  const creditSubTabs = [
    { id: 'list' as CreditSubTab, label: 'Credit Nota\'s', icon: Receipt },
    { id: 'overview' as CreditSubTab, label: 'Credit Overzicht', icon: DollarSign },
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

      {activeMainTab === 'invoices' && (
        <div className="mb-6">
          <div className="flex gap-2 border-b border-dark-700">
            {invoiceSubTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveInvoiceSubTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all border-b-2 ${
                    activeInvoiceSubTab === tab.id
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

      {activeMainTab === 'creditnotes' && (
        <div className="mb-6">
          <div className="flex gap-2 border-b border-dark-700">
            {creditSubTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCreditSubTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all border-b-2 ${
                    activeCreditSubTab === tab.id
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
        {activeMainTab === 'invoices' && activeInvoiceSubTab === 'list' && (
          <InvoiceManagement
            onCreateCreditNote={(invoice, tenant, spaces) => {
              setPrefilledInvoiceData({ invoice, tenant, spaces });
              setActiveMainTab('creditnotes');
              setActiveCreditSubTab('list');
            }}
          />
        )}
        {activeMainTab === 'invoices' && activeInvoiceSubTab === 'outstanding' && (
          <DebtorsOverview initialTab="open" />
        )}
        {activeMainTab === 'invoices' && activeInvoiceSubTab === 'log' && (
          <DebtorsOverview initialTab="log" />
        )}
        {activeMainTab === 'creditnotes' && activeCreditSubTab === 'list' && (
          <CreditNotes
            prefilledInvoiceData={prefilledInvoiceData}
            onClearPrefilled={() => setPrefilledInvoiceData(null)}
          />
        )}
        {activeMainTab === 'creditnotes' && activeCreditSubTab === 'overview' && (
          <CreditOverview />
        )}
      </div>
    </div>
  );
}
