import { X } from 'lucide-react';

type CreditNoteLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

type CreditNotePreviewProps = {
  creditNote: {
    credit_note_number: string;
    credit_date: string;
    reason: string;
    subtotal: number;
    vat_amount: number;
    vat_rate: number;
    total_amount: number;
    notes?: string;
    tenant?: { name: string; company_name: string; email: string; billing_address?: string; street?: string; postal_code?: string; city?: string };
    external_customer?: { company_name: string; contact_name: string; email?: string; street: string; postal_code: string; city: string; country: string };
    credit_note_line_items?: CreditNoteLineItem[];
  };
  companySettings: {
    name: string;
    company_name: string;
    address: string;
    postal_code: string;
    city: string;
    country: string;
    phone: string;
    email: string;
    kvk_number: string;
    btw_number: string;
    bank_account: string;
  } | null;
  onClose: () => void;
};

export function CreditNotePreview({ creditNote, companySettings, onClose }: CreditNotePreviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nl-NL');
  };

  const customerName = creditNote.tenant?.company_name || creditNote.external_customer?.company_name || 'Onbekend';
  const customerAddress = creditNote.tenant
    ? (creditNote.tenant.billing_address || `${creditNote.tenant.street || ''}\n${creditNote.tenant.postal_code || ''} ${creditNote.tenant.city || ''}`)
    : `${creditNote.external_customer?.street}\n${creditNote.external_customer?.postal_code} ${creditNote.external_customer?.city}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Credit Nota Preview</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-8" id="credit-note-preview">
          <div className="bg-white">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold text-red-600 mb-2">CREDIT NOTA</h1>
                <div className="text-gray-600">
                  <p className="font-semibold text-lg">{companySettings?.company_name || 'HAL5 Overloon'}</p>
                  <p>{companySettings?.address}</p>
                  <p>{companySettings?.postal_code} {companySettings?.city}</p>
                  <p className="mt-2">KvK: {companySettings?.kvk_number}</p>
                  <p>BTW: {companySettings?.btw_number}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Credit Nota Nummer</p>
                <p className="text-xl font-bold text-gray-900">{creditNote.credit_note_number}</p>
                <p className="text-sm text-gray-600 mt-2">Datum</p>
                <p className="font-semibold text-gray-900">{formatDate(creditNote.credit_date)}</p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">KLANT</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold text-gray-900">{customerName}</p>
                <p className="text-gray-700 whitespace-pre-line">{customerAddress}</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <p className="text-sm font-semibold text-red-800 mb-1">Reden voor creditering:</p>
                <p className="text-gray-900">{creditNote.reason}</p>
              </div>
            </div>

            <table className="w-full mb-8">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Omschrijving</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Aantal</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Prijs</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {creditNote.credit_note_line_items?.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-3 px-2 text-gray-900">{item.description}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{item.quantity}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 px-2 text-right text-gray-900">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-2 text-gray-700">
                  <span>Subtotaal:</span>
                  <span className="font-semibold">{formatCurrency(creditNote.subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 text-gray-700">
                  <span>BTW ({creditNote.vat_rate}%):</span>
                  <span className="font-semibold">{formatCurrency(creditNote.vat_amount)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-gray-300 text-lg font-bold text-gray-900">
                  <span>Totaal te crediteren:</span>
                  <span className="text-red-600">{formatCurrency(creditNote.total_amount)}</span>
                </div>
              </div>
            </div>

            {creditNote.notes && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">NOTITIES</h3>
                <p className="text-gray-700">{creditNote.notes}</p>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6 mt-8 text-sm text-gray-600">
              <p>Dit bedrag wordt verrekend met openstaande of toekomstige facturen.</p>
              <p className="mt-2">
                Voor vragen kunt u contact opnemen via {companySettings?.email} of {companySettings?.phone}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
