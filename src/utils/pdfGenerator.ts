import jsPDF from 'jspdf';

interface InvoiceData {
  invoice_number: string;
  tenant_name?: string;
  tenant_contact_name?: string;
  tenant_company_name?: string;
  tenant_email: string;
  tenant_phone?: string;
  tenant_billing_address?: string;
  tenant_street?: string;
  tenant_postal_code?: string;
  tenant_city?: string;
  tenant_country?: string;
  invoice_month?: string;
  contract_type?: string;
  notes?: string;
  spaces: Array<{
    space_name: string;
    monthly_rent: number;
    space_type?: string;
    square_footage?: number;
    price_per_sqm?: number;
    hours?: number;
    hourly_rate?: number;
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
    const invoiceNumber = invoice.invoice_number.replace(/^INV-/, '');
    pdf.save(`${invoiceNumber}.pdf`);
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

  // Calculate address lines based on new or old format
  if (invoice.tenant_street) {
    addressLines += 2; // street + postal_code/city
    if (invoice.tenant_country && invoice.tenant_country !== 'Nederland') addressLines++;
  } else if (invoice.tenant_billing_address) {
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
  pdf.text(`t.a.v. ${invoice.tenant_name || invoice.tenant_contact_name || ''}`, margin + 3, yPosition);
  yPosition += 4;

  if (invoice.tenant_company_name) {
    pdf.text(invoice.tenant_company_name, margin + 3, yPosition);
    yPosition += 4;
  }

  // Display address - prefer new format over old
  if (invoice.tenant_street) {
    pdf.text(invoice.tenant_street, margin + 3, yPosition);
    yPosition += 4;
    pdf.text(`${invoice.tenant_postal_code || ''} ${invoice.tenant_city || ''}`.trim(), margin + 3, yPosition);
    yPosition += 4;
    if (invoice.tenant_country && invoice.tenant_country !== 'Nederland') {
      pdf.text(invoice.tenant_country, margin + 3, yPosition);
      yPosition += 4;
    }
  } else if (invoice.tenant_billing_address) {
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
    if (invoice.tenant_street) {
      lines += 2;
      if (invoice.tenant_country && invoice.tenant_country !== 'Nederland') lines++;
    } else if (invoice.tenant_billing_address) {
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
  const col3X = pageWidth - margin - 43;
  const col4X = pageWidth - margin - 30;
  const col5X = pageWidth - margin - 10;

  pdf.setFillColor(234, 179, 8);
  pdf.rect(margin, tableTop, pageWidth - 2 * margin, 8, 'F');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Omschrijving', col1X + 2, tableTop + 5.5);
  pdf.text('Hoeveelheid', col2X, tableTop + 5.5, { align: 'center' });
  pdf.text('Tarief', col3X - 2, tableTop + 5.5, { align: 'right' });
  pdf.text('Bedrag', col4X - 2, tableTop + 5.5, { align: 'right' });
  pdf.text('BTW', col5X - 2, tableTop + 5.5, { align: 'right' });

  yPosition = tableTop + 12;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(9);

  if (invoice.notes) {
    const lines = invoice.notes.split('\n').filter(line => line.trim());
    let lineIndex = 0;

    lines.forEach((line: string) => {
      if (yPosition > pageHeight - 70) {
        pdf.addPage();
        yPosition = 20;
      }

      // Header line (e.g., "Vergaderruimte boekingen:")
      if (line.includes(':') && !line.includes('(') && !line.startsWith('-')) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(line, col1X + 2, yPosition);
        pdf.setFont('helvetica', 'normal');
        yPosition += 7;
        return;
      }

      // Only process lines that start with "-"
      if (!line.startsWith('-')) {
        return;
      }

      if (lineIndex % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');
      }

      // Format: - 04-11-2025 04:00-06:30 (2.5u) = €62.50
      let description = line.replace(/^-\s*/, '').trim();
      let quantity = '';
      let rate = '';
      let amount = '';

      // Extract hours from pattern like (2.5u)
      const hoursMatch = description.match(/\((\d+(?:\.\d+)?)u\)/);
      if (hoursMatch) {
        quantity = `${parseFloat(hoursMatch[1]).toFixed(1)} uur`;
      }

      // Extract amount from pattern like = €62.50
      const amountMatch = description.match(/=\s*€([\d.]+)\s*$/);
      if (amountMatch) {
        amount = amountMatch[1];
        // Calculate hourly rate if we have both hours and amount
        if (hoursMatch) {
          const hours = parseFloat(hoursMatch[1]);
          const totalAmount = parseFloat(amount);
          const hourlyRate = totalAmount / hours;
          rate = `€ ${hourlyRate.toFixed(2)} / uur`;
        }
        description = description.substring(0, description.lastIndexOf('=')).trim();
      }

      pdf.text(description, col1X + 2, yPosition);
      pdf.text(quantity, col2X, yPosition, { align: 'center' });
      pdf.text(rate, col3X - 2, yPosition, { align: 'right' });
      if (amount) {
        pdf.text(`€ ${amount}`, col4X - 2, yPosition, { align: 'right' });
      }
      pdf.text(`${invoice.vat_rate.toFixed(0)}%`, col5X - 2, yPosition, { align: 'right' });

      lineIndex++;
      yPosition += 7;
    });
  } else {
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
    let quantity = '';
    let rate = '';

    if (space.hours && space.hours > 0) {
      quantity = `${space.hours.toFixed(1)} uur`;
      if (space.hourly_rate && space.hourly_rate > 0) {
        rate = `€ ${space.hourly_rate.toFixed(2)} / uur`;
      }
    } else if (space.square_footage && space.space_type !== 'voorschot') {
      const sqm = typeof space.square_footage === 'string' ? parseFloat(space.square_footage) : space.square_footage;
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

    pdf.text(displayName, col1X + 2, yPosition);
    pdf.text(quantity, col2X, yPosition, { align: 'center' });
    pdf.text(rate, col3X - 2, yPosition, { align: 'right' });
    pdf.text(`€ ${space.monthly_rent.toFixed(2)}`, col4X - 2, yPosition, { align: 'right' });
    pdf.text(`${invoice.vat_rate.toFixed(0)}%`, col5X - 2, yPosition, { align: 'right' });

    yPosition += 7;
    });
  }

  if (invoice.security_deposit && invoice.security_deposit > 0) {
    if (yPosition > pageHeight - 70) {
      pdf.addPage();
      yPosition = 20;
    }

    if (invoice.spaces.length % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');
    }

    pdf.text('Voorschot Gas, Water & Electra', col1X + 2, yPosition);
    pdf.text(`€ ${invoice.security_deposit.toFixed(2)}`, col4X - 2, yPosition, { align: 'right' });
    pdf.text(`${invoice.vat_rate.toFixed(0)}%`, col5X - 2, yPosition, { align: 'right' });
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

interface CreditNoteData {
  credit_note_number: string;
  credit_date: string;
  reason: string;
  customer_name: string;
  customer_address: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  subtotal: number;
  vat_amount: number;
  vat_rate: number;
  total_amount: number;
  notes?: string;
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
  };
}

export async function generateCreditNotePDF(creditNote: CreditNoteData, rootPath?: string): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = 20;

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

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(220, 38, 38);
  const creditNoteNumberDisplay = creditNote.credit_note_number.replace(/^CN-/, '');
  pdf.text(`CREDITFACTUUR`, margin, yPosition + 10);

  yPosition = 38;

  const addressLines = creditNote.customer_address.split('\n').filter(line => line.trim());
  let boxHeight = 6 + ((addressLines.length + 1) * 4) + 2;

  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, yPosition, 80, boxHeight, 'F');

  yPosition += 6;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  pdf.text(`t.a.v. ${creditNote.customer_name}`, margin + 3, yPosition);
  yPosition += 4;

  addressLines.forEach(line => {
    pdf.text(line, margin + 3, yPosition);
    yPosition += 4;
  });

  yPosition = 57;
  const creditNoteInfoCol = pageWidth - margin - 55;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(80, 80, 80);
  pdf.text('Creditfactuurnr:', creditNoteInfoCol, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(creditNoteNumberDisplay, creditNoteInfoCol + 30, yPosition);

  yPosition += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Creditdatum:', creditNoteInfoCol, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(new Date(creditNote.credit_date).toLocaleDateString('nl-NL'), creditNoteInfoCol + 30, yPosition);

  const addressBoxBottom = 45 + boxHeight;
  yPosition = Math.max(addressBoxBottom + 8, 75);

  pdf.setFillColor(254, 242, 242);
  pdf.rect(margin, yPosition - 3, pageWidth - 2 * margin, 16, 'F');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(153, 27, 27);
  pdf.text('CREDITFACTUUR', margin + 3, yPosition + 2);

  yPosition += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(8);
  pdf.text('Deze creditfactuur corrigeert een eerder verzonden factuur.', margin + 3, yPosition);
  yPosition += 4;
  pdf.text(`Reden: ${creditNote.reason}`, margin + 3, yPosition);
  yPosition += 8;

  const tableTop = yPosition;
  const col1X = margin;
  const col2X = pageWidth - margin - 85;
  const col3X = pageWidth - margin - 43;
  const col4X = pageWidth - margin - 30;
  const col5X = pageWidth - margin - 10;

  pdf.setFillColor(220, 38, 38);
  pdf.rect(margin, tableTop, pageWidth - 2 * margin, 8, 'F');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Omschrijving', col1X + 2, tableTop + 5.5);
  pdf.text('Hoeveelheid', col2X, tableTop + 5.5, { align: 'center' });
  pdf.text('Tarief', col3X - 2, tableTop + 5.5, { align: 'right' });
  pdf.text('Bedrag', col4X - 2, tableTop + 5.5, { align: 'right' });
  pdf.text('BTW', col5X - 2, tableTop + 5.5, { align: 'right' });

  yPosition = tableTop + 12;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(9);

  creditNote.line_items.forEach((item, index) => {
    if (yPosition > pageHeight - 70) {
      pdf.addPage();
      yPosition = 20;
    }

    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPosition - 3.5, pageWidth - 2 * margin, 7, 'F');
    }

    const description = item.description;
    const quantity = item.quantity > 0 ? item.quantity.toFixed(0) : '';
    const rate = item.unit_price > 0 ? `€ -${item.unit_price.toFixed(2)}` : '';

    pdf.text(description, col1X + 2, yPosition);
    pdf.text(quantity, col2X, yPosition, { align: 'center' });
    pdf.text(rate, col3X - 2, yPosition, { align: 'right' });
    const amount = -item.amount;
    pdf.text(`€ ${amount.toFixed(2)}`, col4X - 2, yPosition, { align: 'right' });
    pdf.text(`${creditNote.vat_rate.toFixed(0)}%`, col5X - 2, yPosition, { align: 'right' });

    yPosition += 7;
  });

  if (creditNote.notes) {
    if (yPosition > pageHeight - 70) {
      pdf.addPage();
      yPosition = 20;
    }

    yPosition += 3;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text('Toelichting:', margin, yPosition);
    yPosition += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    const noteLines = pdf.splitTextToSize(creditNote.notes, pageWidth - 2 * margin);
    pdf.text(noteLines, margin, yPosition);
    yPosition += noteLines.length * 5;
  }

  if (yPosition > pageHeight - 60) {
    pdf.addPage();
    yPosition = 20;
  }

  yPosition += 5;
  const summaryStartY = yPosition;
  const summaryX = pageWidth - margin - 55;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);

  pdf.text('Subtotaal excl. BTW:', summaryX, yPosition);
  pdf.text(`€ -${creditNote.subtotal.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 5;

  pdf.text(`BTW ${creditNote.vat_rate.toFixed(0)}%:`, summaryX, yPosition);
  pdf.text(`€ -${creditNote.vat_amount.toFixed(2)}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 7;

  pdf.setDrawColor(60, 60, 60);
  pdf.setLineWidth(0.5);
  pdf.line(summaryX, yPosition - 2, pageWidth - margin, yPosition - 2);

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(220, 38, 38);
  pdf.text('Totaal incl. BTW:', summaryX, yPosition + 2);
  pdf.text(`€ -${creditNote.total_amount.toFixed(2)}`, pageWidth - margin, yPosition + 2, { align: 'right' });

  yPosition += 10;

  pdf.setFillColor(255, 251, 235);
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 16, 'F');
  yPosition += 5;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(80, 80, 80);
  pdf.text('Let op:', margin + 3, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Dit bedrag wordt in mindering gebracht op uw openstaande saldo.', margin + 16, yPosition);
  yPosition += 4;
  pdf.text('Het gecrediteerde bedrag wordt verrekend met toekomstige facturen of terugbetaald indien gewenst.', margin + 3, yPosition);
  yPosition += 8;

  pdf.setDrawColor(234, 179, 8);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 80, 80);

  if (creditNote.company) {
    const bankLine = `Bankrekening: ${creditNote.company.iban || ''} t.n.v. ${creditNote.company.name || ''}`;
    pdf.text(bankLine, margin, yPosition);
    yPosition += 4;

    const contactLine = `Contact: ${creditNote.company.phone || ''} | ${creditNote.company.email || ''}`;
    pdf.text(contactLine, margin, yPosition);
    yPosition += 4;

    const businessLine = `${creditNote.company.address || ''}, ${creditNote.company.postal_code || ''} ${creditNote.company.city || ''}`;
    pdf.text(businessLine, margin, yPosition);
    yPosition += 4;

    const taxLine = `KvK-nummer: ${creditNote.company.kvk || ''} | BTW-nummer: ${creditNote.company.btw || ''}`;
    pdf.text(taxLine, margin, yPosition);
  }

  pdf.setDrawColor(230, 230, 230);
  pdf.setLineWidth(0.3);
  pdf.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(120, 120, 120);

  if (creditNote.company) {
    const footerY = pageHeight - 18;
    const footerLine1 = `${creditNote.company.name || ''} | KvK: ${creditNote.company.kvk || ''} | BTW: ${creditNote.company.btw || ''}`;
    const footerLine2 = `${creditNote.company.address || ''}, ${creditNote.company.postal_code || ''} ${creditNote.company.city || ''}`;

    let footerLine3 = '';
    if (creditNote.company.phone) footerLine3 += `T: ${creditNote.company.phone}`;
    if (creditNote.company.email) footerLine3 += ` | E: ${creditNote.company.email}`;

    pdf.text(footerLine1, pageWidth / 2, footerY, { align: 'center' });
    pdf.text(footerLine2, pageWidth / 2, footerY + 3, { align: 'center' });
    if (footerLine3) {
      pdf.text(footerLine3, pageWidth / 2, footerY + 6, { align: 'center' });
    }
  }

  if (rootPath && window.electronAPI?.savePDF) {
    const pdfBlob = pdf.output('blob');
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const result = await window.electronAPI.savePDF(
      rootPath,
      creditNote.customer_name,
      creditNote.credit_note_number,
      Array.from(uint8Array),
      true
    );

    if (!result.success) {
      console.error('Failed to save credit note PDF:', result.error);
      pdf.save(`${creditNote.credit_note_number}.pdf`);
    }
  } else {
    pdf.save(`${creditNote.credit_note_number}.pdf`);
  }
}
