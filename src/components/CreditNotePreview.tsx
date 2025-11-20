import { X, Download, Edit, Trash2, Link, Send } from 'lucide-react';

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
    status?: string;
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
  onDownload?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onApply?: () => void;
  onSend?: () => void;
};

export function CreditNotePreview({ creditNote, companySettings, onClose, onDownload, onEdit, onDelete, onApply, onSend }: CreditNotePreviewProps) {
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-2xl my-8 relative max-w-2xl w-full mx-auto">
        <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <h3 className="text-xl font-bold text-gray-800">Credit Nota Preview</h3>
          <div className="flex items-center gap-2">
            {onApply && (
              <button
                onClick={onApply}
                className="flex items-center gap-1 text-yellow-600 hover:text-yellow-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
                title="Toepassen"
              >
                <Link size={20} />
                <span className="text-sm font-medium">Toepassen</span>
              </button>
            )}
            {onSend && (
              <button
                onClick={onSend}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
                title="Versturen"
              >
                <Send size={20} />
                <span className="text-sm font-medium">Versturen</span>
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
                title="Bewerken"
              >
                <Edit size={20} />
                <span className="text-sm font-medium">Bewerken</span>
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center gap-1 text-green-600 hover:text-green-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
                title="Download PDF"
              >
                <Download size={20} />
                <span className="text-sm font-medium">Download</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
                title="Verwijderen"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6 pb-6 border-b border-gray-200">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Klant</h3>
              <p className="text-gray-900 font-medium">{customerName}</p>
              <div className="mt-2 text-sm text-gray-600">
                <p className="whitespace-pre-line">{customerAddress}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-600">Credit Nota Nummer: </span>
                  <span className="font-semibold text-red-600">{creditNote.credit_note_number.replace(/^CN-/, '')}</span>
                </div>
                <div>
                  <span className="text-gray-600">Creditdatum: </span>
                  <span className="text-gray-900">{formatDate(creditNote.credit_date)}</span>
                </div>
                <div className="mt-3 inline-block">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    creditNote.status === 'draft' ? 'bg-gray-200 text-gray-700' :
                    creditNote.status === 'issued' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {creditNote.status === 'draft' ? 'Concept' :
                     creditNote.status === 'issued' ? 'Uitgegeven' : 'Toegepast'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-800 mb-1">Credit Nota - {creditNote.reason}</p>
            <p className="text-xs text-gray-700">Deze creditfactuur corrigeert een eerder verzonden factuur.</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Regels</h4>
            <table className="w-full border border-gray-200">
              <thead>
                <tr className="bg-red-50 border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Omschrijving</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Aantal</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Prijs</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {creditNote.credit_note_line_items?.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm text-gray-900">{item.description}</td>
                    <td className="py-2 px-3 text-sm text-right text-gray-700">{item.quantity}</td>
                    <td className="py-2 px-3 text-sm text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                    <td className="py-2 px-3 text-sm text-right font-medium text-red-600">{formatCurrency(-item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {creditNote.notes && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Opmerkingen</p>
              <p className="text-sm text-gray-600">{creditNote.notes}</p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t-2 border-gray-200 space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Subtotaal (excl. BTW):</span>
              <span className="text-red-600">{formatCurrency(-creditNote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>BTW ({creditNote.vat_rate.toFixed(0)}%):</span>
              <span className="text-red-600">{formatCurrency(-creditNote.vat_amount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-300">
              <span>Totaal Credit:</span>
              <span className="text-red-600">{formatCurrency(-creditNote.total_amount)}</span>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-700">Let op:</p>
            <p className="text-xs text-gray-600 mt-1">Dit bedrag wordt in mindering gebracht op uw openstaande saldo. Het gecrediteerde bedrag kan worden verrekend met toekomstige facturen of terugbetaald indien gewenst.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
