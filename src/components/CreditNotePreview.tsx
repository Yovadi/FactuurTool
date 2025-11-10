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
                <h1 className="text-2xl font-bold text-red-600 mb-2">Credit Nota {creditNote.credit_note_number.replace(/^CN-/, '')}</h1>
              </div>
              <div className="text-right">
                <img src="/image copy copy copy copy copy copy.png" alt="Logo" className="h-12 ml-auto mb-2" />
              </div>
            </div>

            <div className="flex justify-between items-start mb-6">
              <div className="bg-gray-50 p-4 rounded-lg w-80">
                <p className="text-sm text-gray-600">t.a.v. {customerName}</p>
                <p className="text-gray-700 whitespace-pre-line mt-1">{customerAddress}</p>
              </div>

              <div className="text-right text-sm">
                <div className="mb-2">
                  <span className="font-semibold text-gray-600">Credit nota nr: </span>
                  <span className="text-gray-900">{creditNote.credit_note_number.replace(/^CN-/, '')}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Credit datum: </span>
                  <span className="text-gray-900">{formatDate(creditNote.credit_date)}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm">
                <span className="font-semibold text-gray-700">Reden: </span>
                <span className="text-red-600">{creditNote.reason}</span>
              </p>
            </div>

            <table className="w-full mb-8">
              <thead>
                <tr className="bg-red-600 text-white">
                  <th className="text-left py-2 px-2 text-sm font-semibold">Omschrijving</th>
                  <th className="text-right py-2 px-2 text-sm font-semibold">Bedrag</th>
                  <th className="text-right py-2 px-2 text-sm font-semibold w-16">BTW</th>
                </tr>
              </thead>
              <tbody>
                {creditNote.credit_note_line_items?.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-2 px-2 text-gray-900">
                      {item.quantity > 1
                        ? `${item.description} (${item.quantity}x ${formatCurrency(item.unit_price)})`
                        : item.description
                      }
                    </td>
                    <td className="py-2 px-2 text-right text-gray-900">{formatCurrency(item.amount)}</td>
                    <td className="py-2 px-2 text-right text-gray-900">{creditNote.vat_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {creditNote.notes && (
              <div className="border-t border-gray-200 pt-4 mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">Opmerking:</p>
                <p className="text-sm text-gray-700">{creditNote.notes}</p>
              </div>
            )}

            <div className="flex justify-end mb-8">
              <div className="w-64 text-sm">
                <div className="flex justify-between py-1 text-gray-700">
                  <span>Subtotaal:</span>
                  <span className="font-semibold">{formatCurrency(creditNote.subtotal)}</span>
                </div>
                <div className="flex justify-between py-1 text-gray-700">
                  <span>BTW {creditNote.vat_rate}%:</span>
                  <span className="font-semibold">{formatCurrency(creditNote.vat_amount)}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-gray-400 text-base font-bold text-gray-900 mt-1">
                  <span>Te crediteren:</span>
                  <span className="text-red-600">{formatCurrency(creditNote.total_amount)}</span>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-yellow-500 pt-4 mb-8 text-xs text-gray-600">
              <p>Betalen: {companySettings?.bank_account} | {companySettings?.company_name}</p>
              <p className="mt-1">{companySettings?.phone} | {companySettings?.email}</p>
              <p className="mt-1">{companySettings?.address}, {companySettings?.postal_code} {companySettings?.city}</p>
              <p className="mt-1">KvK-nummer: {companySettings?.kvk_number} | BTW-nummer: {companySettings?.btw_number}</p>
            </div>

            <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-500">
              <p>{companySettings?.company_name} | KvK: {companySettings?.kvk_number} | BTW: {companySettings?.btw_number}</p>
              <p className="mt-1">{companySettings?.address}, {companySettings?.postal_code} {companySettings?.city}</p>
              <p className="mt-1">T: {companySettings?.phone} | E: {companySettings?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
