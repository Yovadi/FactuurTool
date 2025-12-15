import { useState, useEffect } from 'react';
import { X, Download, Send, Edit, Receipt, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  onClose: () => void;
  onDownload?: () => void;
  onSend?: () => void;
  onEdit?: () => void;
  onMarkAsPaid?: () => void;
  onCreateCreditNote?: () => void;
}

export function InvoicePreview({
  invoice,
  tenant,
  spaces,
  contractType,
  company,
  onClose,
  onDownload,
  onSend,
  onEdit,
  onMarkAsPaid,
  onCreateCreditNote,
}: InvoicePreviewProps) {
  const [creditApplications, setCreditApplications] = useState<CreditApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const invoiceNumberDisplay = invoice.invoice_number.replace(/^INV-/, '');

  useEffect(() => {
    if (invoice.id && invoice.applied_credit && invoice.applied_credit > 0) {
      loadCreditApplications();
    } else {
      setLoading(false);
    }
  }, [invoice.id]);

  const loadCreditApplications = async () => {
    if (!invoice.id) return;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-dark-900 rounded-lg my-8 relative w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto border border-dark-700">
        <div className="sticky top-0 bg-dark-800 rounded-t-lg border-b border-dark-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-100">Factuur {invoiceNumberDisplay}</h2>
          <div className="flex items-center gap-2">
            {onCreateCreditNote && (
              <button
                onClick={onCreateCreditNote}
                className="flex items-center gap-1 text-gold-400 hover:text-gold-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                title="Maak Credit Nota"
              >
                <FileText size={20} />
                <span className="text-sm font-medium">Credit Nota</span>
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
            {onMarkAsPaid && invoice.status !== 'paid' && (
              <button
                onClick={onMarkAsPaid}
                className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                title="Markeer als betaald"
              >
                <span className="text-sm font-medium">Betaald</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors p-1.5"
            >
              <X size={24} />
            </button>
          </div>
        </div>

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
                  <span className="font-semibold text-gray-100">{invoiceNumberDisplay}</span>
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
            {invoice.notes ? (
              <div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-amber-500 text-white">
                      <th className="px-4 py-2 text-left font-semibold">Omschrijving</th>
                      <th className="px-4 py-2 text-right font-semibold">Bedrag</th>
                      <th className="px-4 py-2 text-right font-semibold">BTW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.notes.split('\n')
                      .filter(line => line.trim())
                      .map((line, lineIndex) => {
                        // Header line (e.g., "Vergaderruimte boekingen:")
                        if (line.includes(':') && !line.includes('(') && !line.startsWith('-')) {
                          return (
                            <tr key={lineIndex}>
                              <td colSpan={3} className="px-4 py-2 font-semibold text-gray-100 bg-dark-800">
                                {line}
                              </td>
                            </tr>
                          );
                        }
                        return null;
                      })
                      .filter(Boolean)}
                    {invoice.notes.split('\n')
                      .filter(line => line.trim() && line.startsWith('-'))
                      .map((line, lineIndex) => {
                        let cleanLine = line.replace(/^-\s*/, '');
                        let amount = '';

                        const amountMatch = cleanLine.match(/=\s*€([\d.]+)\s*$/);
                        if (amountMatch) {
                          amount = amountMatch[1];
                          cleanLine = cleanLine.substring(0, cleanLine.lastIndexOf('=')).trim();
                        }

                        return (
                          <tr key={`line-${lineIndex}`} className={lineIndex % 2 === 0 ? 'bg-dark-800' : 'bg-dark-850'}>
                            <td className="px-4 py-3 text-left text-gray-100">{cleanLine}</td>
                            <td className="px-4 py-3 text-right text-gray-100">{amount ? `€ ${amount}` : ''}</td>
                            <td className="px-4 py-3 text-right text-gray-100">{invoice.vat_rate.toFixed(0)}%</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-amber-500 text-white">
                    <th className="px-4 py-2 text-left font-semibold w-[35%]">Omschrijving</th>
                    <th className="px-4 py-2 text-center font-semibold w-[18%]">Hoeveelheid</th>
                    <th className="px-4 py-2 text-right font-semibold w-[22%]">Tarief</th>
                    <th className="px-4 py-2 text-right font-semibold w-[15%]">Bedrag</th>
                    <th className="px-4 py-2 text-right font-semibold w-[10%]">BTW</th>
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

                    return (
                      <tr key={index} className={index % 2 === 0 ? 'bg-dark-800' : 'bg-dark-850'}>
                        <td className="px-4 py-3 text-left text-gray-100">{displayName}</td>
                        <td className="px-4 py-3 text-center text-gray-100">{quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-100">{rate}</td>
                        <td className="px-4 py-3 text-right text-gray-100">€ {space.monthly_rent.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-100">{invoice.vat_rate.toFixed(0)}%</td>
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
                <span>BTW ({invoice.vat_rate.toFixed(0)}%):</span>
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
      </div>
    </div>
  );
}
