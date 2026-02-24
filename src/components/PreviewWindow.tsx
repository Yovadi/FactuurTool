import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { InvoicePreview } from './InvoicePreview';
import { CreditNotePreview } from './CreditNotePreview';
import { PurchaseInvoicePreview } from './PurchaseInvoicePreview';
import { Loader2 } from 'lucide-react';

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

  useEffect(() => {
    const electron = (window as any).electron;
    if (electron?.onPreviewData) {
      electron.onPreviewData((data: PreviewData) => {
        setPreviewData(data);
      });
    }
  }, []);

  if (!previewData) {
    return (
      <div className="h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-gold-500 animate-spin" size={48} />
          <p className="text-gray-400">Wachten op preview...</p>
        </div>
      </div>
    );
  }

  if (previewData.type === 'invoice') {
    return (
      <div className="h-screen bg-dark-950">
        <DetachedInvoicePreview {...previewData.props} />
      </div>
    );
  }

  if (previewData.type === 'credit-note') {
    return (
      <div className="h-screen bg-dark-950">
        <DetachedCreditNotePreview {...previewData.props} />
      </div>
    );
  }

  if (previewData.type === 'purchase-invoice') {
    return (
      <div className="h-screen bg-dark-950">
        <DetachedPurchaseInvoicePreview {...previewData.props} />
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
  const noop = useCallback(() => {}, []);

  const handleEdit = useCallback(() => {
    sendAction('invoice-edit', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const handleDownload = useCallback(() => {
    sendAction('invoice-download', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const handleSend = useCallback(() => {
    sendAction('invoice-send', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const handleMarkAsPaid = useCallback(() => {
    sendAction('invoice-mark-paid', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const handleCreateCreditNote = useCallback(() => {
    sendAction('invoice-create-credit-note', { invoiceId: props.invoice?.id });
  }, [props.invoice?.id]);

  const showSend = props.invoice?.status !== 'paid';
  const showMarkAsPaid = props.invoice?.status === 'sent';

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
        onClose={noop}
        onEdit={handleEdit}
        onDownload={handleDownload}
        onSend={showSend ? handleSend : undefined}
        onMarkAsPaid={showMarkAsPaid ? handleMarkAsPaid : undefined}
        onCreateCreditNote={handleCreateCreditNote}
      />
    </div>
  );
}

function DetachedCreditNotePreview(props: any) {
  const noop = useCallback(() => {}, []);

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
      onClose={noop}
      onEdit={isDraft ? handleEdit : undefined}
      onDownload={handleDownload}
      onSend={isDraft ? handleSend : undefined}
      onApply={props.creditNote?.status === 'issued' ? handleApply : undefined}
      onDelete={isDraft ? handleDelete : undefined}
    />
  );
}

function DetachedPurchaseInvoicePreview(props: any) {
  const noop = useCallback(() => {}, []);

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
      onClose={noop}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onMarkAsPaid={props.invoice?.status !== 'paid' ? handleMarkAsPaid : undefined}
    />
  );
}
