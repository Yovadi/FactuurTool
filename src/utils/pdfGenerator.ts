import jsPDF from 'jspdf';

interface InvoiceData {
  invoice_number: string;
  tenant_name: string;
  tenant_company_name?: string;
  tenant_email: string;
  tenant_phone?: string;
  tenant_billing_address?: string;
  invoice_month?: string;
  spaces: Array<{
    space_name: string;
    monthly_rent: number;
    space_type?: string;
    square_footage?: number;
    price_per_sqm?: number;
  }>;
  security_deposit?: number;
  subtotal: number;
  amount: number;
  vat_amount: number;
  vat_rate: number;
  vat_inclusive: boolean;
  due_date: string;
  invoice_date: string;
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
}

function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

export async function generateInvoicePDFBase64(invoice: InvoiceData): Promise<string> {
  const pdf = await generateInvoicePDFDocument(invoice);
  return pdf.output('datauristring').split(',')[1];
}

async function generateInvoicePDFDocument(invoice: InvoiceData): Promise<jsPDF> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  await buildInvoicePDF(pdf, invoice);
  return pdf;
}

export async function generateInvoicePDF(invoice: InvoiceData, preview: boolean = false, skipDownload: boolean = false) {
  const pdf = await generateInvoicePDFDocument(invoice);

  if (preview) {
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else if (!skipDownload) {
    pdf.save(`${invoice.invoice_number}.pdf`);
  }

  return pdf;
}

async function buildInvoicePDF(pdf: jsPDF, invoice: InvoiceData) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = 20;

  if (invoice.company) {
    try {
      const logoBase64 = await loadImageAsBase64('/image copy copy copy copy copy copy.png');
      const logoWidth = 60;
      const logoHeight = 30;
      const logoX = pageWidth - margin - logoWidth;
      const logoY = yPosition;
      pdf.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } catch (error) {
      console.error('Failed to load logo:', error);
    }
  }

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(40, 40, 40);
  const invoiceNumberDisplay = invoice.invoice_number.replace(/^INV-/, '');
  pdf.text(`Factuur ${invoiceNumberDisplay}`, margin, yPosition + 10);

  yPosition = 38;

  let boxHeight = 28;
  let addressLines = 1;
  if (invoice.tenant_company_name) addressLines++;
  if (invoice.tenant_billing_address) {
    const lines = pdf.splitTextToSize(invoice.tenant_billing_address, 70);
    addressLines += lines.length;
  }
  if (invoice.tenant_email) addressLines++;
  boxHeight = 6 + (addressLines * 4) + 2;

  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, yPosition, 80, boxHeight, 'F');

  yPosition += 6;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  pdf.text(`t.a.v. ${invoice.tenant_name || ''}`, margin + 3, yPosition);
  yPosition += 4;

  if (invoice.tenant_company_name) {
    pdf.text(invoice.tenant_company_name, margin + 3, yPosition);
    yPosition += 4;
  }

  if (invoice.tenant_billing_address) {
    const lines = pdf.splitTextToSize(invoice.tenant_billing_address, 70);
    for (const line of lines) {
      pdf.text(line, margin + 3, yPosition);
      yPosition += 4;
    }
  }

  if (invoice.tenant_email) {
    pdf.setTextColor(0, 102, 204);
    pdf.text(invoice.tenant_email, margin + 3, yPosition);
  }

  yPosition = 57;
  const invoiceInfoCol = pageWidth - margin - 55;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(80, 80, 80);
  pdf.text('Factuurnummer:', invoiceInfoCol, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(invoiceNumberDisplay, invoiceInfoCol + 30, yPosition);

  yPosition += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Factuurdatum:', invoiceInfoCol, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(new Date(invoice.invoice_date).toLocaleDateString('nl-NL'), invoiceInfoCol + 30, yPosition);

  yPosition += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Vervaldatum:', invoiceInfoCol, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(new Date(invoice.due_date).toLocaleDateString('nl-NL'), invoiceInfoCol + 30, yPosition);

  const addressBoxBottom = 45 + (6 + ((() => {
    let lines = 1;
    if (invoice.tenant_company_name) lines++;
    if (invoice.tenant_billing_address) {
      const tempLines = pdf.splitTextToSize(invoice.tenant_billing_address, 70);
      lines += tempLines.length;
    }
    if (invoice.tenant_email) lines++;
    return lines * 4 + 2;
  })()));

  yPosition = Math.max(addressBoxBottom + 8, 75);

  if (invoice.invoice_month) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(80, 80, 80);
    pdf.text('Factuurmaand:', margin, yPosition);
    pdf.setFont('helvetica', 'normal');
    const [year, month] = invoice.invoice_month.split('-');
    const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    const monthName = monthNames[parseInt(month) - 1];
    pdf.text(monthName + ' ' + year, margin + 30, yPosition);
    yPosition += 8;
  } else {
    yPosition += 3;
  }

  const tableTop = yPosition;
  const col1X = margin;
  const col2X = pageWidth - margin - 85;
  const col3X = pageWidth - margin - 50;
  const col4X = pageWidth - margin - 10;

  pdf.setFillColor(234, 179, 8);
  pdf.rect(margin, tableTop, pageWidth - 2 * margin, 8, 'F');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Omschrijving', col1X + 2, tableTop + 5.5);
  pdf.text('Bedrag', col3X + 2, tableTop + 5.5);
  pdf.text('BTW', col4X - 5, tableTop + 5.5);

  yPosition = tableTop + 12;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(9);

  invoice.spaces.forEach((space, index) => {
    if (yPosition > pageHeight - 70) {
      pdf.addPage();
      yPosition = 20;
    }

    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');
    }

    let displayName = space.space_name;

    // Add square footage to description if available
    if (space.square_footage && space.space_type !== 'voorschot' && space.space_type !== 'diversen') {
      const sqm = typeof space.square_footage === 'string' ? parseFloat(space.square_footage) : space.square_footage;
      if (!isNaN(sqm) && sqm > 0) {
        displayName = `${space.space_name} - ${sqm.toFixed(0)} m²`;
      }
    }

    pdf.text(displayName, col1X + 2, yPosition);
    pdf.text(`€ ${space.monthly_rent.toFixed(2)}`, col3X + 2, yPosition);
    pdf.text(`${invoice.vat_rate.toFixed(0)}%`, col4X - 5, yPosition);

    yPosition += 7;
  });

  if (invoice.security_deposit && invoice.security_deposit > 0) {
    if (yPosition > pageHeight - 70) {
      pdf.addPage();
      yPosition = 20;
    }

    if (invoice.spaces.length % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');
    }

    pdf.text('Voorschot gas, water & elektra', col1X + 2, yPosition);
    pdf.text(`€ ${invoice.security_deposit.toFixed(2)}`, col3X + 2, yPosition);
    pdf.text(`${invoice.vat_rate.toFixed(0)}%`, col4X - 5, yPosition);
    yPosition += 7;
  }

  yPosition += 5;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(pageWidth - margin - 70, yPosition, pageWidth - margin, yPosition);

  yPosition += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Subtotaal (excl. BTW):', pageWidth - margin - 70, yPosition);
  pdf.text(`€ ${invoice.subtotal.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });

  yPosition += 6;
  pdf.text(`BTW (${invoice.vat_rate.toFixed(0)}%):`, pageWidth - margin - 70, yPosition);
  pdf.text(`€ ${invoice.vat_amount.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });

  yPosition += 8;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Totaal te betalen:', pageWidth - margin - 70, yPosition);
  pdf.text(`€ ${invoice.amount.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });

  yPosition += 3;
  pdf.setDrawColor(234, 179, 8);
  pdf.setLineWidth(0.5);
  pdf.line(pageWidth - margin - 70, yPosition, pageWidth - margin, yPosition);

  yPosition += 12;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(40, 40, 40);
  pdf.text('Betaalinformatie', margin, yPosition);

  yPosition += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(60, 60, 60);

  if (invoice.company) {
    pdf.text(`Gelieve het totaalbedrag van €${invoice.amount.toFixed(2)} binnen 14 dagen te voldoen op:`, margin, yPosition);
    yPosition += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`IBAN: ${invoice.company.iban || ''}`, margin, yPosition);
    yPosition += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Ten name van: ${invoice.company.name || ''}`, margin, yPosition);
    yPosition += 4;
    pdf.text(`Onder vermelding van: ${invoiceNumberDisplay}`, margin, yPosition);
  }

  pdf.setDrawColor(230, 230, 230);
  pdf.setLineWidth(0.3);
  pdf.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(120, 120, 120);

  if (invoice.company) {
    const footerY = pageHeight - 18;
    const footerLine1 = `${invoice.company.name || ''} | KvK: ${invoice.company.kvk || ''} | BTW: ${invoice.company.btw || ''}`;
    const footerLine2 = `${invoice.company.address || ''}, ${invoice.company.postal_code || ''} ${invoice.company.city || ''}`;

    let footerLine3 = '';
    if (invoice.company.phone) footerLine3 += `T: ${invoice.company.phone}`;
    if (invoice.company.email) footerLine3 += ` | E: ${invoice.company.email}`;
    if (invoice.company.website) footerLine3 += ` | W: ${invoice.company.website}`;

    pdf.text(footerLine1, pageWidth / 2, footerY, { align: 'center' });
    pdf.text(footerLine2, pageWidth / 2, footerY + 3, { align: 'center' });
    if (footerLine3) {
      pdf.text(footerLine3, pageWidth / 2, footerY + 6, { align: 'center' });
    }
  }
}
