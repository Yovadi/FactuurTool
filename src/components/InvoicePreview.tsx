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
  };
  tenant: {
    name: string;
    company_name?: string;
    email: string;
    phone?: string;
    billing_address?: string;
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
      <div className="bg-white rounded-lg shadow-2xl my-8 relative" style={{ width: '210mm', maxWidth: '95vw', maxHeight: '95vh', overflow: 'auto' }}>
        <button
          onClick={onClose}
          className="sticky top-2 right-2 float-right text-gray-400 hover:text-gray-600 transition-colors z-20 bg-white rounded-full p-1 shadow-lg"
        >
          <X size={20} />
        </button>

        <div style={{ fontFamily: 'helvetica, arial, sans-serif', padding: '20mm', fontSize: '9px' }}>
          <div className="relative" style={{ marginBottom: '30mm' }}>
            <div className="absolute top-0 right-0">
              <img src="/Logo.png" alt="Hal 5 Overloon" style={{ width: '60mm', height: '30mm', objectFit: 'contain' }} />
            </div>

            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#282828', margin: '0' }}>FACTUUR {invoiceNumberDisplay}</h1>
          </div>

          <div className="grid grid-cols-2 gap-8" style={{ marginBottom: '8mm' }}>
            <div>
              <div style={{ backgroundColor: '#f5f5f5', width: '60mm', padding: '3mm' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '1mm', color: '#282828' }}>FACTUUR VOOR:</p>
                <p style={{ fontSize: '9px', color: '#3c3c3c', marginBottom: '0.5mm' }}>t.a.v. {tenant.name}</p>
                {tenant.company_name && (
                  <p style={{ fontSize: '9px', color: '#3c3c3c', marginBottom: '0.5mm' }}>{tenant.company_name}</p>
                )}
                {tenant.billing_address && (
                  <p style={{ fontSize: '9px', color: '#3c3c3c', whiteSpace: 'pre-line', marginBottom: '0.5mm' }}>{tenant.billing_address}</p>
                )}
                <p style={{ fontSize: '9px', color: '#0066cc' }}>{tenant.email}</p>
              </div>
            </div>

            <div>
              {company && (
                <>
                  <p style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '1mm', color: '#3c3c3c' }}>{company.name}</p>
                  <p style={{ fontSize: '8px', color: '#505050', marginBottom: '0.5mm' }}>{company.address}</p>
                  <p style={{ fontSize: '8px', color: '#505050', marginBottom: '0.5mm' }}>{company.postal_code} {company.city}</p>
                  {company.phone && <p style={{ fontSize: '8px', color: '#505050', marginBottom: '0.5mm' }}>T: {company.phone}</p>}
                  {company.email && <p style={{ fontSize: '8px', color: '#505050', marginBottom: '0.5mm' }}>E: {company.email}</p>}
                  {company.website && <p style={{ fontSize: '8px', color: '#505050' }}>W: {company.website}</p>}
                </>
              )}
            </div>
          </div>

          <div className="mb-6 flex justify-end" style={{ marginBottom: '5mm', paddingRight: '10mm' }}>
            <div style={{ fontSize: '8px', color: '#505050' }}>
              <div className="flex" style={{ marginBottom: '1mm', gap: '8mm' }}>
                <span style={{ fontWeight: 'bold' }}>FACTUURNUMMER:</span>
                <span>{invoiceNumberDisplay}</span>
              </div>
              <div className="flex" style={{ marginBottom: '1mm', gap: '8mm' }}>
                <span style={{ fontWeight: 'bold' }}>FACTUURDATUM:</span>
                <span>{formatDate(invoice.invoice_date)}</span>
              </div>
              <div className="flex" style={{ gap: '8mm' }}>
                <span style={{ fontWeight: 'bold' }}>VERVALDATUM:</span>
                <span>{formatDate(invoice.due_date)}</span>
              </div>
            </div>
          </div>

          {invoice.invoice_month && (
            <div style={{ marginBottom: '4mm', fontSize: '8px', color: '#505050' }}>
              <span style={{ fontWeight: 'bold' }}>FACTUURMAAND:</span>
              <span style={{ marginLeft: '2mm' }}>{getMonthName(invoice.invoice_month)}</span>
            </div>
          )}

          <div style={{ marginBottom: '8mm', marginTop: '5mm' }}>
            <div style={{ backgroundColor: '#eab308', height: '8mm', display: 'flex', alignItems: 'center', fontSize: '9px', color: 'white', fontWeight: 'bold' }}>
              <div style={{ paddingLeft: '2mm', width: '120mm' }}>OMSCHRIJVING</div>
              <div style={{ paddingLeft: '2mm', width: '40mm' }}>BEDRAG</div>
              <div style={{ paddingRight: '5mm', width: '20mm', textAlign: 'right' }}>BTW</div>
            </div>

            {spaces.map((space, index) => {
              let displayName = space.space_name;

              // Add square footage to description if available
              if (space.square_footage && space.space_type !== 'voorschot' && space.space_type !== 'diversen') {
                const sqm = typeof space.square_footage === 'string' ? parseFloat(space.square_footage as string) : space.square_footage;
                if (!isNaN(sqm) && sqm > 0) {
                  displayName = `${space.space_name} - ${sqm.toFixed(0)} m²`;
                }
              }

              return (
                <div
                  key={index}
                  style={{
                    backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                    height: '7mm',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '9px',
                    color: '#3c3c3c'
                  }}
                >
                  <div style={{ paddingLeft: '2mm', width: '120mm' }}>{displayName}</div>
                  <div style={{ paddingLeft: '2mm', width: '40mm' }}>€ {space.monthly_rent.toFixed(2)}</div>
                  <div style={{ paddingRight: '5mm', width: '20mm', textAlign: 'right' }}>{invoice.vat_rate.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end" style={{ marginBottom: '8mm' }}>
            <div style={{ width: '70mm' }}>
              <div style={{ borderTop: '1px solid #c8c8c8' }}>
                <div className="flex justify-between" style={{ padding: '2mm 0', fontSize: '9px', color: '#3c3c3c' }}>
                  <span>Subtotaal (excl. BTW):</span>
                  <span>€ {invoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between" style={{ padding: '1mm 0', fontSize: '9px', color: '#3c3c3c' }}>
                  <span>BTW ({invoice.vat_rate.toFixed(0)}%):</span>
                  <span>€ {invoice.vat_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between" style={{ paddingTop: '2mm', fontSize: '11px', fontWeight: 'bold', borderTop: '2px solid #eab308', color: '#282828' }}>
                  <span>Totaal te betalen:</span>
                  <span>€ {invoice.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {company && (
            <div style={{ marginBottom: '8mm' }}>
              <h3 style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '2mm', color: '#282828' }}>Betaalinformatie</h3>
              <div style={{ fontSize: '8px', color: '#3c3c3c' }}>
                <p style={{ marginBottom: '1mm' }}>Gelieve het totaalbedrag van €{invoice.amount.toFixed(2)} binnen 14 dagen te voldoen op:</p>
                <p style={{ fontWeight: 'bold', marginBottom: '1mm' }}>IBAN: {company.iban}</p>
                <p style={{ marginBottom: '1mm' }}>Ten name van: {company.name}</p>
                <p>Onder vermelding van: {invoiceNumberDisplay}</p>
              </div>
            </div>
          )}

          {company && (
            <div style={{ paddingTop: '4mm', borderTop: '1px solid #e6e6e6', textAlign: 'center', fontSize: '7px', color: '#787878' }}>
              <p style={{ marginBottom: '0.5mm' }}>{company.name} | KvK: {company.kvk} | BTW: {company.btw}</p>
              <p style={{ marginBottom: '0.5mm' }}>{company.address}, {company.postal_code} {company.city}</p>
              <p>
                {company.phone && `T: ${company.phone}`}
                {company.email && ` | E: ${company.email}`}
                {company.website && ` | W: ${company.website}`}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
