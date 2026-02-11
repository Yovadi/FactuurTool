import { X, Download, Edit2, Trash2, CheckCircle, Clock, AlertCircle, Sparkles } from 'lucide-react';

type LineItem = {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  vat_rate?: number;
};

type PurchaseInvoice = {
  id: string;
  invoice_number: string;
  supplier_name: string;
  supplier_address: string;
  supplier_postal_code: string;
  supplier_city: string;
  supplier_country: string;
  supplier_vat_number: string;
  supplier_kvk_number: string;
  supplier_iban: string;
  invoice_date: string;
  due_date: string | null;
  order_number: string;
  subtotal: number;
  vat_amount: number;
  vat_rate: number;
  total_amount: number;
  status: string;
  category: string;
  notes: string;
  original_file_name: string;
  ai_extracted: boolean;
  ai_confidence: number;
  purchase_invoice_line_items?: LineItem[];
};

type PurchaseInvoicePreviewProps = {
  invoice: PurchaseInvoice;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkAsPaid?: () => void;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });

export function PurchaseInvoicePreview({ invoice, onClose, onEdit, onDelete, onMarkAsPaid }: PurchaseInvoicePreviewProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'paid': return { color: 'text-green-400', bg: 'bg-green-900/30 border-green-800/40', label: 'Betaald', icon: CheckCircle };
      case 'pending': return { color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800/40', label: 'In Afwachting', icon: Clock };
      case 'overdue': return { color: 'text-red-400', bg: 'bg-red-900/30 border-red-800/40', label: 'Verlopen', icon: AlertCircle };
      default: return { color: 'text-gray-400', bg: 'bg-dark-800 border-dark-600', label: 'Concept', icon: Clock };
    }
  };

  const statusConfig = getStatusConfig(invoice.status);
  const StatusIcon = statusConfig.icon;
  const lineItems = invoice.purchase_invoice_line_items || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-dark-700 flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-100">Inkoopfactuur</h3>
            <p className="text-sm text-gray-400 mt-1">{invoice.invoice_number || 'Geen nummer'}</p>
          </div>
          <div className="flex items-center gap-2">
            {invoice.ai_extracted && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-500/10 rounded-lg" title={`AI confidence: ${invoice.ai_confidence}%`}>
                <Sparkles size={14} className="text-gold-500" />
                <span className="text-gold-500 text-xs font-medium">AI</span>
              </div>
            )}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${statusConfig.bg}`}>
              <StatusIcon size={14} className={statusConfig.color} />
              <span className={`text-xs font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs uppercase text-gray-500 font-semibold mb-2 tracking-wider">Leverancier</h4>
                <div className="bg-dark-800 rounded-lg p-4">
                  <p className="text-gray-100 font-semibold text-lg">{invoice.supplier_name || '-'}</p>
                </div>
              </div>

              {(invoice.supplier_vat_number || invoice.supplier_kvk_number || invoice.supplier_iban) && (
                <div>
                  <h4 className="text-xs uppercase text-gray-500 font-semibold mb-2 tracking-wider">Bedrijfsgegevens</h4>
                  <div className="bg-dark-800 rounded-lg p-4 space-y-1.5">
                    {invoice.supplier_vat_number && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">BTW-nummer</span>
                        <span className="text-gray-200">{invoice.supplier_vat_number}</span>
                      </div>
                    )}
                    {invoice.supplier_kvk_number && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">KVK-nummer</span>
                        <span className="text-gray-200">{invoice.supplier_kvk_number}</span>
                      </div>
                    )}
                    {invoice.supplier_iban && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">IBAN</span>
                        <span className="text-gray-200 font-mono text-xs">{invoice.supplier_iban}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs uppercase text-gray-500 font-semibold mb-2 tracking-wider">Factuurgegevens</h4>
                <div className="bg-dark-800 rounded-lg p-4 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Factuurdatum</span>
                    <span className="text-gray-200">{formatDate(invoice.invoice_date)}</span>
                  </div>
                  {invoice.order_number && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Ordernummer</span>
                      <span className="text-gray-200">{invoice.order_number}</span>
                    </div>
                  )}
                  {invoice.due_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Vervaldatum</span>
                      <span className="text-gray-200">{formatDate(invoice.due_date)}</span>
                    </div>
                  )}
                  {invoice.category && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Categorie</span>
                      <span className="text-gray-200 capitalize">{invoice.category}</span>
                    </div>
                  )}
                  {invoice.original_file_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Bestand</span>
                      <span className="text-gray-200 truncate ml-4 max-w-[200px]">{invoice.original_file_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {invoice.notes && (
                <div>
                  <h4 className="text-xs uppercase text-gray-500 font-semibold mb-2 tracking-wider">Notities</h4>
                  <div className="bg-dark-800 rounded-lg p-4">
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {lineItems.length > 0 && (
            <div>
              <h4 className="text-xs uppercase text-gray-500 font-semibold mb-2 tracking-wider">Regelitems</h4>
              <div className="bg-dark-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700 text-gray-500 text-xs uppercase">
                      <th className="text-left px-4 py-3 font-semibold">Omschrijving</th>
                      <th className="text-right px-4 py-3 font-semibold">Aantal</th>
                      <th className="text-right px-4 py-3 font-semibold">Prijs</th>
                      <th className="text-right px-4 py-3 font-semibold">Bedrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-dark-700/50">
                        <td className="px-4 py-3 text-gray-200 text-sm">{item.description}</td>
                        <td className="px-4 py-3 text-gray-300 text-sm text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-gray-300 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-gray-100 text-sm text-right font-medium">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-dark-800 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Subtotaal</span>
              <span className="text-gray-200">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">BTW ({invoice.vat_rate}%)</span>
              <span className="text-gray-200">{formatCurrency(invoice.vat_amount)}</span>
            </div>
            <div className="flex justify-between text-lg border-t border-dark-600 pt-2 mt-2">
              <span className="text-gray-100 font-bold">Totaal</span>
              <span className="text-gold-500 font-bold">{formatCurrency(invoice.total_amount)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between p-6 border-t border-dark-700 flex-shrink-0">
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-sm"
          >
            <Trash2 size={16} />
            Verwijderen
          </button>
          <div className="flex gap-2">
            {onMarkAsPaid && invoice.status !== 'paid' && (
              <button
                onClick={onMarkAsPaid}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <CheckCircle size={16} />
                Markeer als Betaald
              </button>
            )}
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2.5 bg-gold-500 text-dark-950 rounded-lg hover:bg-gold-600 transition-colors text-sm font-medium"
            >
              <Edit2 size={16} />
              Bewerken
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
