import { X, Download, Send } from 'lucide-react';

interface InvoiceSpace {
  space_name: string;
  monthly_rent: number;
  space_type?: string;
  square_footage?: number;
  price_per_sqm?: number;
}

interface InvoicePreviewProps {
  invoice: {
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
}

export function InvoicePreview({
  invoice,
  tenant,
  spaces,
  company,
  onClose,
  onDownload,
  onSend,
}: InvoicePreviewProps) {
  const invoiceNumberDisplay = invoice.invoice_number.replace(/^INV-/, '');

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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-2xl my-8 relative max-w-2xl w-full mx-auto">
        <div className="sticky top-0 bg-white rounded-t-lg border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Factuur {invoiceNumberDisplay}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6 pb-6 border-b border-gray-200">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Klant</h3>
              <p className="text-gray-900 font-medium">{tenant.name || tenant.contact_name}</p>
              {tenant.company_name && (
                <p className="text-gray-600 text-sm">{tenant.company_name}</p>
              )}
              {(tenant.street || tenant.billing_address) && (
                <div className="mt-2 text-sm text-gray-600">
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
                  <span className="text-gray-600">Factuurnummer: </span>
                  <span className="font-semibold text-gray-900">{invoiceNumberDisplay}</span>
                </div>
                <div>
                  <span className="text-gray-600">Factuurdatum: </span>
                  <span className="text-gray-900">{formatDate(invoice.invoice_date)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Vervaldatum: </span>
                  <span className="text-gray-900">{formatDate(invoice.due_date)}</span>
                </div>
                {invoice.invoice_month && (
                  <div>
                    <span className="text-gray-600">Factuurmaand: </span>
                    <span className="text-gray-900">{getMonthName(invoice.invoice_month)}</span>
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
                              <td colSpan={3} className="px-4 py-2 font-semibold text-gray-900 bg-gray-100">
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
                          <tr key={`line-${lineIndex}`} className={lineIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-left text-gray-900">{cleanLine}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{amount ? `€ ${amount}` : ''}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{invoice.vat_rate.toFixed(0)}%</td>
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
                    <th className="px-4 py-2 text-left font-semibold">Omschrijving</th>
                    <th className="px-4 py-2 text-right font-semibold">Bedrag</th>
                    <th className="px-4 py-2 text-right font-semibold">BTW</th>
                  </tr>
                </thead>
                <tbody>
                  {spaces.map((space, index) => {
                    let displayName = space.space_name;
                    if (space.square_footage && space.space_type !== 'voorschot' && space.space_type !== 'diversen') {
                      const sqm = typeof space.square_footage === 'string' ? parseFloat(space.square_footage as string) : space.square_footage;
                      if (!isNaN(sqm) && sqm > 0) {
                        displayName = `${space.space_name} - ${sqm.toFixed(0)} m²`;
                      }
                    }

                    return (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-left text-gray-900">{displayName}</td>
                        <td className="px-4 py-3 text-right text-gray-900">€ {space.monthly_rent.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{invoice.vat_rate.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div className="mt-6 pt-4 border-t-2 border-gray-200 space-y-2">
              <div className="flex justify-between text-gray-700">
                <span>Subtotaal (excl. BTW):</span>
                <span>€ {invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>BTW ({invoice.vat_rate.toFixed(0)}%):</span>
                <span>€ {invoice.vat_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-300">
                <span>Totaal te betalen:</span>
                <span>€ {invoice.amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
