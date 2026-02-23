import { useState, useEffect } from 'react';
import { InvoicePreview } from './InvoicePreview';
import { CreditNotePreview } from './CreditNotePreview';
import { PurchaseInvoicePreview } from './PurchaseInvoicePreview';
import { Loader2 } from 'lucide-react';

type PreviewData = {
  type: 'invoice' | 'credit-note' | 'purchase-invoice';
  props: any;
};

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
      <div className="h-screen bg-dark-950 overflow-y-auto">
        <DetachedInvoicePreview {...previewData.props} />
      </div>
    );
  }

  if (previewData.type === 'credit-note') {
    return (
      <div className="h-screen bg-dark-950 overflow-y-auto">
        <DetachedCreditNotePreview {...previewData.props} />
      </div>
    );
  }

  if (previewData.type === 'purchase-invoice') {
    return (
      <div className="h-screen bg-dark-950 overflow-y-auto">
        <DetachedPurchaseInvoicePreview {...previewData.props} />
      </div>
    );
  }

  return null;
}

function DetachedInvoicePreview(props: any) {
  return (
    <div className="bg-dark-900 min-h-screen">
      <div className="sticky top-0 bg-dark-800 border-b border-dark-700 px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-100">
          Factuur <span className={props.invoiceTypeColor || 'text-gray-100'}>
            {props.invoice?.invoice_number?.replace(/^INV-/, '') || 'Onbekend'}
          </span>
        </h2>
      </div>
      <div className="p-6">
        <InvoicePreviewContent
          invoice={props.invoice}
          tenant={props.tenant}
          spaces={props.spaces}
          contractType={props.contractType}
          company={props.company}
          invoiceTypeColor={props.invoiceTypeColor}
        />
      </div>
    </div>
  );
}

function InvoicePreviewContent({ invoice, tenant, spaces, contractType, invoiceTypeColor }: any) {
  const invoiceNumberDisplay = invoice?.invoice_number?.replace(/^INV-/, '') || 'Onbekend';

  const getMonthName = (invoiceMonth: string) => {
    const [year, month] = invoiceMonth.split('-');
    const monthNames = [
      'januari', 'februari', 'maart', 'april', 'mei', 'juni',
      'juli', 'augustus', 'september', 'oktober', 'november', 'december'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('nl-NL');

  if (!invoice || !tenant) {
    return <p className="text-red-400">Ontbrekende factuurgegevens</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6 pb-6 border-b border-dark-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Klant</h3>
          <p className="text-gray-100 font-medium">{tenant.name || tenant.contact_name}</p>
          {tenant.company_name && <p className="text-gray-400 text-sm">{tenant.company_name}</p>}
          {(tenant.street || tenant.billing_address) && (
            <div className="mt-2 text-sm text-gray-400">
              {tenant.street ? (
                <>
                  <p>{tenant.street}</p>
                  <p>{tenant.postal_code} {tenant.city}</p>
                  {tenant.country && tenant.country !== 'Nederland' && <p>{tenant.country}</p>}
                </>
              ) : (
                <p className="whitespace-pre-line">{tenant.billing_address}</p>
              )}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-gray-400">Factuurnummer: </span>
              <span className={`font-semibold ${invoiceTypeColor || 'text-gray-100'}`}>{invoiceNumberDisplay}</span>
            </div>
            <div>
              <span className="text-gray-400">Factuurdatum: </span>
              <span className="text-gray-100">{formatDate(invoice.invoice_date)}</span>
            </div>
            <div>
              <span className="text-gray-400">Vervaldatum: </span>
              <span className="text-gray-100">{formatDate(invoice.due_date)}</span>
            </div>
            {invoice.invoice_month && (
              <div>
                <span className="text-gray-400">Factuurmaand: </span>
                <span className="text-gray-100">{getMonthName(invoice.invoice_month)}</span>
              </div>
            )}
            {contractType && (
              <div>
                <span className="text-gray-400">Contract type: </span>
                <span className="text-gray-100">
                  {contractType === 'flex' ? 'Flex contract' : contractType === 'regular' ? 'Vast contract' : contractType}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        {invoice.notes && invoice.notes.split('\n').filter((line: string) => line.trim() && line.startsWith('-')).length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="bg-amber-500 text-white">
                <th className="px-4 py-2 text-left font-semibold w-[70%]">Omschrijving</th>
                <th className="px-4 py-2 text-right font-semibold w-[30%]">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {invoice.notes.split('\n').filter((line: string) => line.trim()).map((line: string, lineIndex: number) => {
                if (line.includes(':') && !line.includes('(') && !line.startsWith('-')) {
                  return (
                    <tr key={lineIndex}>
                      <td colSpan={2} className="px-4 py-2 font-semibold text-gray-100 bg-dark-800">
                        {line.replace(':', '')}
                      </td>
                    </tr>
                  );
                }
                if (line.startsWith('-')) {
                  let cleanLine = line.replace(/^-\s*/, '');
                  let amount = '';
                  const amountMatch = cleanLine.match(/=\s*€([\d.]+)\s*$/);
                  if (amountMatch) {
                    amount = amountMatch[1];
                    cleanLine = cleanLine.substring(0, cleanLine.lastIndexOf('=')).trim();
                  }
                  const isDiscount = cleanLine.toLowerCase().startsWith('totale korting') || cleanLine.toLowerCase().startsWith('korting');
                  const amountText = amount ? (isDiscount ? `€ -${amount}` : `€ ${amount}`) : '';
                  return (
                    <tr key={`line-${lineIndex}`} className={lineIndex % 2 === 0 ? 'bg-dark-800' : 'bg-dark-850'}>
                      <td className={`px-4 py-3 text-left ${isDiscount ? 'text-green-400' : 'text-gray-100'}`}>{cleanLine}</td>
                      <td className={`px-4 py-3 text-right ${isDiscount ? 'text-green-400' : 'text-gray-100'}`}>{amountText}</td>
                    </tr>
                  );
                }
                return null;
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-amber-500 text-white">
                <th className="px-4 py-2 text-left font-semibold w-[40%]">Omschrijving</th>
                <th className="px-4 py-2 text-right font-semibold w-[20%]">Hoeveelheid</th>
                <th className="px-4 py-2 text-right font-semibold w-[20%]">Tarief</th>
                <th className="px-4 py-2 text-right font-semibold w-[20%]">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {(spaces || []).map((space: any, index: number) => {
                let quantity = '';
                let rate = '';
                if (space.hours && space.hours > 0) {
                  quantity = `${space.hours.toFixed(1)} uur`;
                  if (space.hourly_rate && space.hourly_rate > 0) rate = `€ ${space.hourly_rate.toFixed(2)} / uur`;
                } else if (space.square_footage && space.space_type !== 'voorschot') {
                  const sqm = typeof space.square_footage === 'string' ? parseFloat(space.square_footage) : space.square_footage;
                  if (!isNaN(sqm) && sqm > 0) {
                    if (space.space_type === 'flex') {
                      quantity = `${sqm.toFixed(0)} dagen`;
                      if (space.price_per_sqm && space.price_per_sqm > 0) rate = `€ ${space.price_per_sqm.toFixed(2)} / dag`;
                    } else if (space.space_type === 'diversen') {
                      const isDiversenFixed = space.price_per_sqm && Math.abs(sqm - space.price_per_sqm) < 0.01;
                      if (isDiversenFixed) {
                        quantity = '1';
                        rate = `€ ${space.price_per_sqm.toFixed(2)}`;
                      } else {
                        quantity = sqm.toFixed(0);
                        if (space.price_per_sqm && space.price_per_sqm > 0) rate = `€ ${space.price_per_sqm.toFixed(2)}`;
                      }
                    } else {
                      quantity = `${sqm.toFixed(0)} m²`;
                      if (space.price_per_sqm && space.price_per_sqm > 0) {
                        const isAnnualRate = space.space_type === 'bedrijfsruimte' || space.space_type === 'buitenterrein' ||
                          space.space_name?.toLowerCase().includes('hal ') || space.space_name?.toLowerCase().includes('bedrijfsruimte') ||
                          space.space_name?.toLowerCase().includes('buitenterrein');
                        rate = isAnnualRate ? `€ ${space.price_per_sqm.toFixed(2)} / m² / jaar` : `€ ${space.price_per_sqm.toFixed(2)} / m²`;
                      }
                    }
                  }
                }
                const isDiscount = space.space_type === 'discount' || space.monthly_rent < 0 || space.space_name?.toLowerCase().includes('korting');
                const amountClass = isDiscount ? 'text-green-400' : 'text-gray-100';
                const absoluteAmount = Math.abs(space.monthly_rent);
                return (
                  <tr key={index} className={index % 2 === 0 ? 'bg-dark-800' : 'bg-dark-850'}>
                    <td className={`px-4 py-3 text-left ${isDiscount ? 'text-green-400' : 'text-gray-100'}`}>{space.space_name}</td>
                    <td className={`px-4 py-3 text-right ${amountClass}`}>{quantity}</td>
                    <td className={`px-4 py-3 text-right ${amountClass}`}>{rate}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${amountClass}`}>
                      € {isDiscount || space.monthly_rent < 0 ? '-' : ''}{absoluteAmount.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="mt-6 pt-4 border-t-2 border-dark-700 space-y-2">
          <div className="flex justify-between text-gray-300">
            <span>Subtotaal (excl. BTW):</span>
            <span>€ {invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>{invoice.vat_rate === 0 ? 'BTW niet van toepassing' : `BTW (${invoice.vat_rate.toFixed(0)}%)`}:</span>
            <span>€ {invoice.vat_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-100 pt-2 border-t border-dark-700">
            <span>Totaal te betalen:</span>
            <span>€ {invoice.amount.toFixed(2)}</span>
          </div>
          {invoice.applied_credit && invoice.applied_credit > 0 && (
            <>
              <div className="flex justify-between text-green-400 font-medium pt-2">
                <span>Toegepast Credit:</span>
                <span>- € {invoice.applied_credit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-gold-400 pt-2 border-t-2 border-dark-700">
                <span>Openstaand Bedrag:</span>
                <span>€ {(invoice.amount - invoice.applied_credit).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetachedCreditNotePreview(props: any) {
  const { creditNote, companySettings } = props;
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('nl-NL');

  const customerName = creditNote.tenant?.company_name || creditNote.external_customer?.company_name || 'Onbekend';
  const customerAddress = creditNote.tenant
    ? (creditNote.tenant.billing_address || `${creditNote.tenant.street || ''}\n${creditNote.tenant.postal_code || ''} ${creditNote.tenant.city || ''}`)
    : `${creditNote.external_customer?.street}\n${creditNote.external_customer?.postal_code} ${creditNote.external_customer?.city}`;

  return (
    <div className="bg-dark-900 min-h-screen">
      <div className="sticky top-0 bg-dark-800 border-b border-dark-700 px-6 py-4">
        <h3 className="text-xl font-bold text-gray-100">Credit Nota Preview</h3>
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
                <span className="font-semibold text-red-400">{creditNote.credit_note_number?.replace(/^CN-/, '')}</span>
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
              {creditNote.credit_note_line_items?.map((item: any, index: number) => (
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
            <span>BTW ({creditNote.vat_rate?.toFixed(0)}%):</span>
            <span className="text-red-400">{formatCurrency(-creditNote.vat_amount)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-100 pt-2 border-t border-dark-600">
            <span>Totaal Credit:</span>
            <span className="text-red-400">{formatCurrency(-creditNote.total_amount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetachedPurchaseInvoicePreview(props: any) {
  const { invoice } = props;
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });

  const lineItems = invoice.purchase_invoice_line_items || [];

  return (
    <div className="bg-dark-900 min-h-screen">
      <div className="sticky top-0 bg-dark-800 border-b border-dark-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-100">Inkoopfactuur</h3>
            <p className="text-sm text-gray-400 mt-1">{invoice.invoice_number || 'Geen nummer'}</p>
          </div>
          <div className="flex items-center gap-2">
            {invoice.ai_extracted && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-500/10 rounded-lg">
                <span className="text-gold-500 text-xs font-medium">AI</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
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
                  {lineItems.map((item: any, idx: number) => (
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
    </div>
  );
}
