import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { InvoicePreview } from './InvoicePreview';
import { CreditNotePreview } from './CreditNotePreview';
import { PurchaseInvoicePreview } from './PurchaseInvoicePreview';
import { QuickSummaryPanel } from './QuickSummaryPanel';
import { ActivityLogPanel } from './ActivityLogPanel';
import { Loader2, BarChart3, ScrollText } from 'lucide-react';

const LazyEmailTab = lazy(() => import('./EmailTab').then(m => ({ default: m.EmailTab })));

type PreviewData = {
  type: 'invoice' | 'credit-note' | 'purchase-invoice' | 'email';
  props: any;
};

function sendAction(action: string, data?: any) {
  const electron = (window as any).electron;
  if (electron?.sendPreviewAction) {
    electron.sendPreviewAction(action, data);
  }
}

export function PreviewWindow() {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const electron = (window as any).electron;
    if (electron?.onPreviewData) {
      electron.onPreviewData((data: PreviewData) => {
        setError(null);
        try {
          setPreviewData(data);
        } catch (e: any) {
          setError(e?.message || 'Onbekende fout bij het laden van preview data');
        }
      });
    }
  }, []);

  const handleReturnToIdle = useCallback(() => {
    setPreviewData(null);
    setError(null);
  }, []);

  if (error) {
    return (
      <div className="h-screen bg-dark-950 flex items-center justify-center p-8">
        <div className="bg-dark-900 rounded-lg border border-dark-700 p-6 max-w-md">
          <p className="text-red-400 font-medium mb-2">Fout bij het laden van preview</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={handleReturnToIdle}
            className="bg-gold-500 hover:bg-gold-400 text-white px-4 py-2 rounded-lg text-sm"
          >
            Terug
          </button>
        </div>
      </div>
    );
  }

  if (!previewData) {
    return <IdlePanel />;
  }

  if (previewData.type === 'invoice') {
    return (
      <div className="h-screen bg-dark-950">
        <DetachedInvoicePreview {...previewData.props} onReturnToIdle={handleReturnToIdle} />
      </div>
    );
  }

  if (previewData.type === 'credit-note') {
    return (
      <div className="h-screen bg-dark-950">
        <DetachedCreditNotePreview {...previewData.props} onReturnToIdle={handleReturnToIdle} />
      </div>
    );
  }

  if (previewData.type === 'purchase-invoice') {
    return (
      <div className="h-screen bg-dark-950">
        <DetachedPurchaseInvoicePreview {...previewData.props} onReturnToIdle={handleReturnToIdle} />
      </div>
    );
  }

  if (previewData.type === 'email') {
    return (
      <div className="h-screen bg-dark-950 overflow-y-auto p-6">
        <Suspense fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-gold-500" size={32} />
          </div>
        }>
          <LazyEmailTab />
        </Suspense>
      </div>
    );
  }

  return null;
}

function DetachedInvoicePreview(props: any) {
  const status = props.invoice?.status;

  const handleDownload = useCallback(() => {
    sendAction('invoice-download', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const handleMarkAsPaid = useCallback(() => {
    sendAction('invoice-mark-paid', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const handleCreateCreditNote = useCallback(() => {
    sendAction('invoice-create-credit-note', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const handleRevertToDraft = useCallback(() => {
    sendAction('invoice-revert-draft', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const handleDelete = useCallback(() => {
    sendAction('invoice-delete', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const showMarkAsPaid = status === 'sent' || status === 'overdue';
  const showRevertToDraft = status === 'sent';

  return (
    <div className="h-full">
      <InvoicePreview
        inline
        invoice={props.invoice}
        tenant={props.tenant}
        spaces={props.spaces}
        contractType={props.contractType}
        company={props.company}
        invoiceTypeColor={props.invoiceTypeColor}
        onClose={props.onReturnToIdle}
        onDownload={handleDownload}
        onMarkAsPaid={showMarkAsPaid ? handleMarkAsPaid : undefined}
        onCreateCreditNote={handleCreateCreditNote}
        onRevertToDraft={showRevertToDraft ? handleRevertToDraft : undefined}
        onDelete={handleDelete}
      />
    </div>
  );
}

function DetachedCreditNotePreview(props: any) {
  const handleEdit = useCallback(() => {
    sendAction('credit-note-edit', { creditNoteId: props.creditNote?.id });
  }, [props.creditNote?.id]);

  const handleDownload = useCallback(() => {
    sendAction('credit-note-download', { creditNoteId: props.creditNote?.id });
  }, [props.creditNote?.id]);

  const handleSend = useCallback(() => {
    sendAction('credit-note-send', { creditNoteId: props.creditNote?.id });
  }, [props.creditNote?.id]);

  const handleApply = useCallback(() => {
    sendAction('credit-note-apply', { creditNoteId: props.creditNote?.id });
  }, [props.creditNote?.id]);

  const handleDelete = useCallback(() => {
    sendAction('credit-note-delete', { creditNoteId: props.creditNote?.id });
  }, [props.creditNote?.id]);

  const isDraft = props.creditNote?.status === 'draft';

  return (
    <CreditNotePreview
      inline
      creditNote={props.creditNote}
      companySettings={props.companySettings}
      onClose={props.onReturnToIdle}
      onEdit={isDraft ? handleEdit : undefined}
      onDownload={handleDownload}
      onSend={isDraft ? handleSend : undefined}
      onApply={props.creditNote?.status === 'issued' ? handleApply : undefined}
      onDelete={isDraft ? handleDelete : undefined}
    />
  );
}

function DetachedPurchaseInvoicePreview(props: any) {
  const handleEdit = useCallback(() => {
    sendAction('purchase-invoice-edit', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const handleDelete = useCallback(() => {
    sendAction('purchase-invoice-delete', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const handleMarkAsPaid = useCallback(() => {
    sendAction('purchase-invoice-mark-paid', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  return (
    <PurchaseInvoicePreview
      inline
      invoice={props.invoice}
      onClose={props.onReturnToIdle}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onMarkAsPaid={props.invoice?.status !== 'paid' ? handleMarkAsPaid : undefined}
    />
  );
}

function IdlePanel() {
  const [view, setView] = useState<'summary' | 'activity'>(() => {
    const saved = localStorage.getItem('hal5-splitscreen-idle');
    return saved === 'activity' ? 'activity' : 'summary';
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.view === 'summary' || detail?.view === 'activity') {
        setView(detail.view);
      }
    };
    window.addEventListener('splitscreen-idle-changed', handler);
    return () => window.removeEventListener('splitscreen-idle-changed', handler);
  }, []);

  return (
    <div className="h-screen bg-dark-950 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex gap-1 bg-dark-900 rounded-lg p-1 border border-dark-700">
          <button
            onClick={() => setView('summary')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              view === 'summary'
                ? 'bg-gold-500 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <BarChart3 size={15} />
            Snelle Samenvatting
          </button>
          <button
            onClick={() => setView('activity')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              view === 'activity'
                ? 'bg-gold-500 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <ScrollText size={15} />
            Activiteitenlogboek
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {view === 'summary' && <QuickSummaryPanel />}
        {view === 'activity' && <ActivityLogPanel />}
      </div>
    </div>
  );
}
