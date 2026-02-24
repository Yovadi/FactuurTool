import { useState, useEffect, useRef } from 'react';
import { X, Download, Send, Edit, Receipt, FileText, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateInvoicePDFBlobUrl } from '../utils/pdfGenerator';

interface InvoiceSpace {
  space_name: string;
  monthly_rent: number;
  space_type?: string;
  square_footage?: number;
  price_per_sqm?: number;
  hourly_rate?: number;
  hours?: number;
}

interface CreditApplication {
  id: string;
  applied_amount: number;
  application_date: string;
  credit_notes: {
    credit_note_number: string;
  };
}

interface InvoicePreviewProps {
  invoice: {
    id?: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    invoice_month?: string;
    subtotal: number;
    vat_amount: number;
    amount: number;
    vat_rate: number;
    vat_inclusive: boolean;
    status: string;
    notes?: string;
    applied_credit?: number;
  };
  tenant: {
    name?: string;
    contact_name?: string;
    company_name?: string;
    email: string;
    phone?: string;
    billing_address?: string;
    street?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  };
  spaces: InvoiceSpace[];
  contractType?: string;
  company?: {
    name: string;
    address: string;
    postal_code: string;
    city: string;
    kvk: string;
    btw: string;
    iban: string;
    email?: string;
    phone?: string;
    website?: string;
  };
  invoiceTypeColor?: string;
  onClose: () => void;
  onDownload?: () => void;
  onSend?: () => void;
  onEdit?: () => void;
  onMarkAsPaid?: () => void;
  onCreateCreditNote?: () => void;
  onRevertToDraft?: () => void;
  onPopOut?: () => void;
  inline?: boolean;
}

export function InvoicePreview({
  invoice,
  tenant,
  spaces,
  contractType,
  company,
  invoiceTypeColor,
  onClose,
  onDownload,
  onSend,
  onEdit,
  onMarkAsPaid,
  onCreateCreditNote,
  onRevertToDraft,
  onPopOut,
  inline = false,
}: InvoicePreviewProps) {
  const [creditApplications, setCreditApplications] = useState<CreditApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfLoadingRef = useRef(false);
  const prevInvoiceIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (invoice?.id && invoice?.applied_credit && invoice.applied_credit > 0) {
      const loadApps = async () => {
        const { data } = await supabase
          .from('credit_note_applications')
          .select(`
            id,
            applied_amount,
            application_date,
            credit_notes (
              credit_note_number
            )
          `)
          .eq('invoice_id', invoice.id)
          .order('application_date', { ascending: false });
        if (data) {
          setCreditApplications(data as CreditApplication[]);
        }
        setLoading(false);
      };
      loadApps();
    } else {
      setLoading(false);
    }
  }, [invoice?.id]);

  useEffect(() => {
    if (!invoice || !tenant) return;

    const invoiceChanged = prevInvoiceIdRef.current !== invoice.id;
    prevInvoiceIdRef.current = invoice.id;

    if (invoiceChanged) {
      setPdfUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      pdfLoadingRef.current = false;
    }

    if (pdfLoadingRef.current) return;
    if (!invoiceChanged && pdfUrl) return;

    pdfLoadingRef.current = true;
    setPdfLoading(true);

    generateInvoicePDFBlobUrl({
      invoice_number: invoice.invoice_number,
      tenant_name: tenant.name || tenant.contact_name || '',
      tenant_company_name: tenant.company_name || '',
      tenant_email: tenant.email || '',
      tenant_phone: tenant.phone || undefined,
      tenant_billing_address: tenant.billing_address || undefined,
      tenant_street: tenant.street || undefined,
      tenant_postal_code: tenant.postal_code || undefined,
      tenant_city: tenant.city || undefined,
      tenant_country: tenant.country || undefined,
      invoice_month: invoice.invoice_month || undefined,
      contract_type: contractType || undefined,
      notes: invoice.notes || undefined,
      spaces: spaces.map(s => ({
        space_name: s.space_name,
        monthly_rent: s.monthly_rent,
        space_type: s.space_type,
        square_footage: s.square_footage,
        price_per_sqm: s.price_per_sqm,
        hours: s.hours,
        hourly_rate: s.hourly_rate,
      })),
      security_deposit: 0,
      subtotal: invoice.subtotal,
      amount: invoice.amount,
      vat_amount: invoice.vat_amount,
      vat_rate: invoice.vat_rate,
      vat_inclusive: invoice.vat_inclusive,
      due_date: invoice.due_date,
      invoice_date: invoice.invoice_date,
      company,
    }).then(url => {
      setPdfUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    }).catch(err => {
      console.error('PDF generation error:', err);
    }).finally(() => {
      pdfLoadingRef.current = false;
      setPdfLoading(false);
    });
  }, [invoice?.id, invoice, tenant, spaces, contractType, company]);

  if (!invoice || !tenant) {
    if (inline) {
      return (
        <div className="bg-dark-900 rounded-lg p-6">
          <p className="text-red-400 mb-4">Fout: Ontbrekende factuurgegevens</p>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-dark-900 rounded-lg p-6 max-w-md">
          <p className="text-red-400 mb-4">Fout: Ontbrekende factuurgegevens</p>
          <button onClick={onClose} className="bg-gold-500 hover:bg-gold-400 text-white px-4 py-2 rounded">
            Sluiten
          </button>
        </div>
      </div>
    );
  }

  const invoiceNumberDisplay = invoice.invoice_number?.replace(/^INV-/, '') || 'Onbekend';

  const getMonthName = (invoiceMonth: string) => {
    const [year, month] = invoiceMonth.split('-');
    const monthNames = [
      'januari', 'februari', 'maart', 'april', 'mei', 'juni',
      'juli', 'augustus', 'september', 'oktober', 'november', 'december'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL');
  };

  const actionButtons = (
    <div className="flex items-center gap-2 flex-wrap">
      {onCreateCreditNote && (
        <button
          onClick={onCreateCreditNote}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white transition-colors px-3 py-1.5 rounded-lg"
          title="Maak Credit Nota"
        >
          <FileText size={16} />
          <span className="text-sm font-medium">Credit Nota</span>
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
      {onMarkAsPaid && invoice.status !== 'paid' && (
        <button
          onClick={onMarkAsPaid}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white transition-colors px-3 py-1.5 rounded-lg"
          title="Markeer als betaald"
        >
          <span className="text-sm font-medium">Betaald</span>
        </button>
      )}
      {onRevertToDraft && (
        <button
          onClick={onRevertToDraft}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white transition-colors px-3 py-1.5 rounded-lg"
          title="Terug naar concept"
        >
          <RotateCcw size={16} />
          <span className="text-sm font-medium">Naar concept</span>
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

  const htmlPreviewContent = (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6 pb-6 border-b border-dark-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Klant</h3>
          <p className="text-gray-100 font-medium">{tenant.name || tenant.contact_name}</p>
          {tenant.company_name && (
            <p className="text-gray-400 text-sm">{tenant.company_name}</p>
          )}
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
        {invoice.notes && invoice.notes.split('\n').filter(line => line.trim() && line.startsWith('-')).length > 0 ? (
          <div>
            <table className="w-full">
              <thead>
                <tr className="bg-amber-500 text-white">
                  <th className="px-4 py-2 text-left font-semibold w-[70%]">Omschrijving</th>
                  <th className="px-4 py-2 text-right font-semibold w-[30%]">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const lines = invoice.notes.split('\n').filter(line => line.trim());
                  return (
                    <>
                      {lines.map((line, lineIndex) => {
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
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
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
              {spaces.map((space, index) => {
                let displayName = space.space_name;
                let quantity = '';
                let rate = '';
                if (space.hours && space.hours > 0) {
                  quantity = `${space.hours.toFixed(1)} uur`;
                  if (space.hourly_rate && space.hourly_rate > 0) {
                    rate = `€ ${space.hourly_rate.toFixed(2)} / uur`;
                  }
                } else if (space.square_footage && space.space_type !== 'voorschot') {
                  const sqm = typeof space.square_footage === 'string' ? parseFloat(space.square_footage as string) : space.square_footage;
                  if (!isNaN(sqm) && sqm > 0) {
                    if (space.space_type === 'flex') {
                      quantity = `${sqm.toFixed(0)} dagen`;
                      if (space.price_per_sqm && space.price_per_sqm > 0) {
                        rate = `€ ${space.price_per_sqm.toFixed(2)} / dag`;
                      }
                    } else if (space.space_type === 'diversen') {
                      const isDiversenFixed = space.price_per_sqm && Math.abs(sqm - space.price_per_sqm) < 0.01;
                      if (isDiversenFixed) {
                        quantity = '1';
                        rate = `€ ${space.price_per_sqm.toFixed(2)}`;
                      } else {
                        quantity = sqm.toFixed(0);
                        if (space.price_per_sqm && space.price_per_sqm > 0) {
                          rate = `€ ${space.price_per_sqm.toFixed(2)}`;
                        }
                      }
                    } else {
                      quantity = `${sqm.toFixed(0)} m²`;
                      if (space.price_per_sqm && space.price_per_sqm > 0) {
                        const isAnnualRate = space.space_type === 'bedrijfsruimte' ||
                                              space.space_type === 'buitenterrein' ||
                                              displayName.toLowerCase().includes('hal ') ||
                                              displayName.toLowerCase().includes('bedrijfsruimte') ||
                                              displayName.toLowerCase().includes('buitenterrein');
                        if (isAnnualRate) {
                          rate = `€ ${space.price_per_sqm.toFixed(2)} / m² / jaar`;
                        } else {
                          rate = `€ ${space.price_per_sqm.toFixed(2)} / m²`;
                        }
                      }
                    }
                  }
                }
                const isDiscount = space.space_type === 'discount' || space.monthly_rent < 0 || displayName.toLowerCase().includes('korting');
                const amountClass = isDiscount ? 'text-green-400' : 'text-gray-100';
                const absoluteAmount = Math.abs(space.monthly_rent);
                return (
                  <tr key={index} className={index % 2 === 0 ? 'bg-dark-800' : 'bg-dark-850'}>
                    <td className={`px-4 py-3 text-left ${isDiscount ? 'text-green-400' : 'text-gray-100'}`}>{displayName}</td>
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

        {!loading && creditApplications.length > 0 && (
          <div className="mt-6 p-4 bg-dark-800 border border-dark-700 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Receipt size={20} className="text-green-400" />
              <h4 className="font-semibold text-green-400">Toegepaste Credit Nota's</h4>
            </div>
            <div className="space-y-2">
              {creditApplications.map((app) => (
                <div key={app.id} className="flex justify-between text-sm">
                  <span className="text-gray-300">
                    {app.credit_notes.credit_note_number} ({formatDate(app.application_date)})
                  </span>
                  <span className="font-medium text-green-400">
                    - € {app.applied_amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
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

  if (inline) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-dark-800 border-b border-dark-700 px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-lg font-bold text-gray-100 truncate">Factuur <span className={invoiceTypeColor || 'text-gray-100'}>{invoiceNumberDisplay}</span></h2>
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
          {pdfLoading ? (
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
              title={`Factuur ${invoiceNumberDisplay}`}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="text-gold-500 animate-spin" />
                <span className="text-sm text-gray-400">PDF laden...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dark-900 rounded-lg my-8 relative w-full max-w-5xl mx-4 h-[90vh] flex flex-col border border-dark-700">
        <div className="flex-shrink-0 bg-dark-800 rounded-t-lg border-b border-dark-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-100">Factuur <span className={invoiceTypeColor || 'text-gray-100'}>{invoiceNumberDisplay}</span></h2>
          {actionButtons}
        </div>
        <div className="flex-1 overflow-hidden bg-gray-700 rounded-b-lg">
          {pdfLoading || !pdfUrl ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="text-gold-500 animate-spin" />
                <span className="text-sm text-gray-400">PDF genereren...</span>
              </div>
            </div>
          ) : (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={`Factuur ${invoiceNumberDisplay}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
