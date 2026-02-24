import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Download, Edit, Trash2, Link, Send, ExternalLink, Loader2 } from 'lucide-react';
import { generateCreditNotePDFBlobUrl, CreditNoteData } from '../utils/pdfGenerator';

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
    credit_note_line_items?: { description: string; quantity: number; unit_price: number; amount: number }[];
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
  onPopOut?: () => void;
  inline?: boolean;
};

export function CreditNotePreview({ creditNote, companySettings, onClose, onDownload, onEdit, onDelete, onApply, onSend, onPopOut, inline = false }: CreditNotePreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfLoadingRef = useRef(false);

  useEffect(() => {
    setPdfUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    pdfLoadingRef.current = false;
  }, [creditNote.credit_note_number]);

  const loadPdf = useCallback(async () => {
    if (!creditNote || pdfLoadingRef.current) return;
    pdfLoadingRef.current = true;
    setPdfLoading(true);
    try {
      const customerName = creditNote.tenant?.company_name || creditNote.external_customer?.company_name || 'Onbekend';
      const customerAddress = creditNote.tenant
        ? (creditNote.tenant.billing_address || `${creditNote.tenant.street || ''}\n${creditNote.tenant.postal_code || ''} ${creditNote.tenant.city || ''}`)
        : `${creditNote.external_customer?.street || ''}\n${creditNote.external_customer?.postal_code || ''} ${creditNote.external_customer?.city || ''}`;

      const pdfData: CreditNoteData = {
        credit_note_number: creditNote.credit_note_number,
        credit_date: creditNote.credit_date,
        reason: creditNote.reason,
        customer_name: customerName,
        customer_address: customerAddress,
        line_items: (creditNote.credit_note_line_items || []).map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
        })),
        subtotal: creditNote.subtotal,
        vat_amount: creditNote.vat_amount,
        vat_rate: creditNote.vat_rate,
        total_amount: creditNote.total_amount,
        notes: creditNote.notes,
        company: companySettings ? {
          name: companySettings.name,
          address: companySettings.address,
          postal_code: companySettings.postal_code,
          city: companySettings.city,
          kvk: companySettings.kvk_number,
          btw: companySettings.btw_number,
          iban: companySettings.bank_account,
          email: companySettings.email,
          phone: companySettings.phone,
        } : undefined,
      };

      const url = await generateCreditNotePDFBlobUrl(pdfData);
      setPdfUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      console.error('Credit note PDF generation error:', err);
    } finally {
      pdfLoadingRef.current = false;
      setPdfLoading(false);
    }
  }, [creditNote, companySettings]);

  useEffect(() => {
    if (creditNote && !pdfUrl && !pdfLoadingRef.current) {
      loadPdf();
    }
  }, [creditNote.credit_note_number, loadPdf]);

  const creditNoteNumberDisplay = creditNote.credit_note_number?.replace(/^CN-/, '') || 'Onbekend';

  const actionButtons = (
    <div className="flex items-center gap-2 flex-wrap">
      {onApply && (
        <button
          onClick={onApply}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white transition-colors px-3 py-1.5 rounded-lg"
          title="Toepassen"
        >
          <Link size={16} />
          <span className="text-sm font-medium">Toepassen</span>
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white transition-colors px-3 py-1.5 rounded-lg"
          title="Bewerken"
        >
          <Edit size={16} />
          <span className="text-sm font-medium">Bewerken</span>
        </button>
      )}
      {onDownload && (
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white transition-colors px-3 py-1.5 rounded-lg"
          title="Download PDF"
        >
          <Download size={16} />
          <span className="text-sm font-medium">Download</span>
        </button>
      )}
      {onSend && (
        <button
          onClick={onSend}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white transition-colors px-3 py-1.5 rounded-lg"
          title="Versturen"
        >
          <Send size={16} />
          <span className="text-sm font-medium">Versturen</span>
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white transition-colors px-3 py-1.5 rounded-lg"
          title="Verwijderen"
        >
          <Trash2 size={16} />
        </button>
      )}
      {onPopOut && (
        <button
          onClick={onPopOut}
          className="flex items-center gap-1.5 bg-dark-700 hover:bg-dark-600 text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg"
          title="Open in apart venster"
        >
          <ExternalLink size={16} />
          <span className="text-sm font-medium">Venster</span>
        </button>
      )}
      {!inline && (
        <button
          onClick={onClose}
          className="bg-red-600 hover:bg-red-500 text-white transition-colors p-1.5 rounded-lg"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );

  const pdfContent = pdfLoading ? (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="text-gold-500 animate-spin" />
        <span className="text-sm text-gray-400">PDF genereren...</span>
      </div>
    </div>
  ) : pdfUrl ? (
    <iframe
      src={pdfUrl}
      className="w-full h-full border-0"
      title={`Credit Nota ${creditNoteNumberDisplay}`}
    />
  ) : (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="text-gold-500 animate-spin" />
        <span className="text-sm text-gray-400">PDF laden...</span>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-dark-800 border-b border-dark-700 px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-lg font-bold text-red-400 truncate">Credit Nota {creditNoteNumberDisplay}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 transition-colors p-1 flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>
          {actionButtons}
        </div>
        <div className="flex-1 overflow-hidden bg-gray-700">
          {pdfContent}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dark-900 rounded-lg my-8 relative w-full max-w-5xl mx-4 h-[90vh] flex flex-col border border-dark-700">
        <div className="flex-shrink-0 bg-dark-800 rounded-t-lg border-b border-dark-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-red-400">Credit Nota {creditNoteNumberDisplay}</h2>
          {actionButtons}
        </div>
        <div className="flex-1 overflow-hidden bg-gray-700 rounded-b-lg">
          {pdfContent}
        </div>
      </div>
    </div>
  );
}
