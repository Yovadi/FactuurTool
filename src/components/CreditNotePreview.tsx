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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-dark-900 rounded-lg my-8 relative max-w-5xl w-full mx-auto border border-dark-700">
        <div className="sticky top-0 bg-dark-800 border-b border-dark-700 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <h3 className="text-xl font-bold text-gray-100">Credit Nota Preview</h3>
          <div className="flex items-center gap-2">
            {onApply && (
              <button
                onClick={onApply}
                className="flex items-center gap-1 text-gold-400 hover:text-gold-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                title="Toepassen"
              >
                <Link size={20} />
                <span className="text-sm font-medium">Toepassen</span>
              </button>
            )}
            {onSend && (
              <button
                onClick={onSend}
                className="flex items-center gap-1 text-gray-300 hover:text-gray-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                title="Versturen"
              >
                <Send size={20} />
                <span className="text-sm font-medium">Versturen</span>
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1 text-gray-300 hover:text-gray-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                title="Bewerken"
              >
                <Edit size={20} />
                <span className="text-sm font-medium">Bewerken</span>
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center gap-1 text-gold-400 hover:text-gold-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                title="Download PDF"
              >
                <Download size={20} />
                <span className="text-sm font-medium">Download</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                title="Verwijderen"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400 hover:text-gray-200" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6 pb-6 border-b border-dark-700">
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2">Klant</h3>
              <p className="text-gray-100 font-medium">{customerName}</p>
              <div className="mt-2 text-sm text-gray-400">
                <p className="whitespace-pre-line">{customerAddress}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-400">Credit Nota Nummer: </span>
                  <span className="font-semibold text-red-400">{creditNote.credit_note_number.replace(/^CN-/, '')}</span>
                </div>
                <div>
                  <span className="text-gray-400">Creditdatum: </span>
                  <span className="text-gray-100">{formatDate(creditNote.credit_date)}</span>
                </div>
                <div className="mt-3 inline-block">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    creditNote.status === 'draft' ? 'bg-gray-700 text-gray-300' :
                    creditNote.status === 'issued' ? 'bg-blue-900 text-blue-300' :
                    'bg-green-900 text-green-300'
                  }`}>
                    {creditNote.status === 'draft' ? 'Concept' :
                     creditNote.status === 'issued' ? 'Uitgegeven' : 'Toegepast'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-300 mb-1">Credit Nota - {creditNote.reason}</p>
            <p className="text-xs text-gray-400">Deze creditfactuur corrigeert een eerder verzonden factuur.</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-200 mb-3">Regels</h4>
            <table className="w-full border border-dark-700">
              <thead>
                <tr className="bg-dark-800 border-b border-dark-700">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-200">Omschrijving</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-200">Aantal</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-200">Prijs</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-200">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {creditNote.credit_note_line_items?.map((item, index) => (
                  <tr key={index} className="border-b border-dark-700">
                    <td className="py-2 px-3 text-sm text-gray-100">{item.description}</td>
                    <td className="py-2 px-3 text-sm text-right text-gray-300">{item.quantity}</td>
                    <td className="py-2 px-3 text-sm text-right text-gray-300">{formatCurrency(item.unit_price)}</td>
                    <td className="py-2 px-3 text-sm text-right font-medium text-red-400">{formatCurrency(-item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {creditNote.notes && (
            <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-200 mb-2">Opmerkingen</p>
              <p className="text-sm text-gray-400">{creditNote.notes}</p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t-2 border-dark-700 space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>Subtotaal (excl. BTW):</span>
              <span className="text-red-400">{formatCurrency(-creditNote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>BTW ({creditNote.vat_rate.toFixed(0)}%):</span>
              <span className="text-red-400">{formatCurrency(-creditNote.vat_amount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-100 pt-2 border-t border-dark-600">
              <span>Totaal Credit:</span>
              <span className="text-red-400">{formatCurrency(-creditNote.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
