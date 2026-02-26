import jsPDF from 'jspdf';
import { getLogoBase64 } from './logoLoader';

export interface LeaseContractData {
  tenant_name: string;
  tenant_company_name: string;
  tenant_street?: string;
  tenant_postal_code?: string;
  tenant_city?: string;
  tenant_country?: string;
  tenant_email?: string;
  tenant_phone?: string;
  lease_type: 'full_time' | 'flex';
  start_date: string;
  end_date: string;
  vat_rate: number;
  vat_inclusive: boolean;
  security_deposit: number;
  spaces: Array<{
    space_number: string;
    space_type: string;
    square_footage: number;
    price_per_sqm: number;
    monthly_rent: number;
  }>;
  flex?: {
    credits_per_week: number;
    flex_credit_rate: number;
    flex_day_type: 'full_day' | 'half_day';
    space_number?: string;
  };
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getSpaceTypeLabel(spaceType: string): string {
  const labels: Record<string, string> = {
    kantoor: 'Kantoor',
    bedrijfsruimte: 'Bedrijfsruimte',
    buitenterrein: 'Buitenterrein',
    diversen: 'Overig',
    meeting_room: 'Vergaderruimte',
    Flexplek: 'Flexplek',
  };
  return labels[spaceType] || spaceType;
}

async function buildLeaseContractPDF(pdf: jsPDF, data: LeaseContractData) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let y = 20;

  if (data.company) {
    try {
      const logoBase64 = await getLogoBase64();
      if (logoBase64 && logoBase64.length > 100) {
        pdf.addImage(logoBase64, 'PNG', pageWidth - margin - 60, y, 60, 30);
      }
    } catch {}
  }

  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(40, 40, 40);
  pdf.text('HUUROVEREENKOMST', margin, y + 12);

  y += 20;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    data.lease_type === 'flex' ? 'Flexcontract' : 'Huurcontract kantoorruimte',
    margin,
    y
  );

  y += 14;

  // --- Partij 1: Verhuurder ---
  pdf.setFillColor(234, 179, 8);
  pdf.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('VERHUURDER', margin + 3, y + 5.5);
  y += 12;

  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);

  if (data.company) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(data.company.name, margin, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${data.company.address}`, margin, y);
    y += 5;
    pdf.text(`${data.company.postal_code} ${data.company.city}`, margin, y);
    y += 5;
    pdf.text(`KvK: ${data.company.kvk}`, margin, y);
    pdf.text(`BTW: ${data.company.btw}`, margin + 50, y);
    y += 5;
    if (data.company.email) {
      pdf.text(`E-mail: ${data.company.email}`, margin, y);
      y += 5;
    }
    if (data.company.phone) {
      pdf.text(`Telefoon: ${data.company.phone}`, margin, y);
      y += 5;
    }
  }

  y += 6;

  // --- Partij 2: Huurder ---
  pdf.setFillColor(234, 179, 8);
  pdf.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('HUURDER', margin + 3, y + 5.5);
  y += 12;

  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.tenant_company_name || data.tenant_name, margin, y);
  y += 5;
  pdf.setFont('helvetica', 'normal');
  if (data.tenant_company_name && data.tenant_name) {
    pdf.text(`t.a.v. ${data.tenant_name}`, margin, y);
    y += 5;
  }
  if (data.tenant_street) {
    pdf.text(data.tenant_street, margin, y);
    y += 5;
    pdf.text(
      `${data.tenant_postal_code || ''} ${data.tenant_city || ''}`.trim(),
      margin,
      y
    );
    y += 5;
    if (data.tenant_country && data.tenant_country !== 'Nederland') {
      pdf.text(data.tenant_country, margin, y);
      y += 5;
    }
  }
  if (data.tenant_email) {
    pdf.text(`E-mail: ${data.tenant_email}`, margin, y);
    y += 5;
  }
  if (data.tenant_phone) {
    pdf.text(`Telefoon: ${data.tenant_phone}`, margin, y);
    y += 5;
  }

  y += 8;

  // --- Contract details ---
  pdf.setFillColor(234, 179, 8);
  pdf.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('CONTRACTGEGEVENS', margin + 3, y + 5.5);
  y += 14;

  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);

  const addField = (label: string, value: string) => {
    if (y > pageHeight - 30) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, margin + 45, y);
    y += 6;
  };

  addField('Ingangsdatum:', formatDate(data.start_date));
  addField('Einddatum:', formatDate(data.end_date));
  addField(
    'Looptijd:',
    (() => {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());
      const years = Math.floor(months / 12);
      const remaining = months % 12;
      if (years > 0 && remaining > 0) return `${years} jaar en ${remaining} maand(en)`;
      if (years > 0) return `${years} jaar`;
      return `${months} maand(en)`;
    })()
  );
  addField(
    'BTW:',
    `${data.vat_rate}% (${data.vat_inclusive ? 'inclusief' : 'exclusief'})`
  );
  addField('Type:', data.lease_type === 'flex' ? 'Flexplek' : 'Voltijd');

  y += 4;

  // --- Gehuurde ruimte(s) ---
  if (y > pageHeight - 60) {
    pdf.addPage();
    y = 20;
  }

  pdf.setFillColor(234, 179, 8);
  pdf.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);

  if (data.lease_type === 'flex') {
    pdf.text('FLEXPLEK DETAILS', margin + 3, y + 5.5);
    y += 14;

    if (data.flex) {
      pdf.setFontSize(9);
      pdf.setTextColor(60, 60, 60);

      const dayLabel =
        data.flex.flex_day_type === 'half_day' ? 'halve dag' : 'hele dag';
      const daysLabel =
        data.flex.flex_day_type === 'half_day' ? 'halve dagen' : 'dagen';

      if (data.flex.space_number) {
        addField('Flex-ruimte:', data.flex.space_number);
      }
      addField('Dagen per week:', `${data.flex.credits_per_week} ${daysLabel}`);
      addField(
        `Tarief per ${dayLabel}:`,
        `\u20AC ${data.flex.flex_credit_rate.toFixed(2)}`
      );

      const weeklyRent =
        data.flex.credits_per_week * data.flex.flex_credit_rate;
      const monthlyRent = weeklyRent * 4.33;

      addField('Weekhuur:', `\u20AC ${weeklyRent.toFixed(2)}`);

      y += 2;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(40, 40, 40);
      pdf.text('Maandelijkse huurprijs:', margin, y);
      pdf.text(`\u20AC ${monthlyRent.toFixed(2)}`, margin + 50, y);
      y += 8;
      pdf.setFontSize(9);
    }
  } else {
    pdf.text('GEHUURDE RUIMTE(S)', margin + 3, y + 5.5);
    y += 12;

    // Table header
    const colX = [margin, margin + 45, margin + 85, margin + 110, pageWidth - margin];
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, y - 3, pageWidth - 2 * margin, 8, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(80, 80, 80);
    pdf.text('Ruimte', colX[0] + 2, y + 2);
    pdf.text('Type', colX[1], y + 2);
    pdf.text('m\u00B2', colX[2], y + 2, { align: 'right' });
    pdf.text('Tarief', colX[3], y + 2, { align: 'right' });
    pdf.text('Maandhuur', colX[4] - 2, y + 2, { align: 'right' });
    y += 9;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);

    let totalMonthlyRent = 0;

    data.spaces.forEach((space, index) => {
      if (y > pageHeight - 40) {
        pdf.addPage();
        y = 20;
      }

      if (index % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, y - 4, pageWidth - 2 * margin, 7, 'F');
      }

      pdf.text(space.space_number, colX[0] + 2, y);
      pdf.text(getSpaceTypeLabel(space.space_type), colX[1], y);

      const isDiversenFixed =
        space.space_type === 'diversen' &&
        Math.abs(space.square_footage - space.price_per_sqm) < 0.01;

      if (!isDiversenFixed && space.square_footage > 0) {
        pdf.text(`${space.square_footage} m\u00B2`, colX[2], y, {
          align: 'right',
        });
      }

      if (space.price_per_sqm > 0) {
        const isAnnual =
          space.space_type === 'bedrijfsruimte' ||
          space.space_type === 'buitenterrein';
        const rateLabel = isDiversenFixed
          ? `\u20AC ${space.price_per_sqm.toFixed(2)}`
          : isAnnual
            ? `\u20AC ${space.price_per_sqm.toFixed(2)}/m\u00B2/jr`
            : `\u20AC ${space.price_per_sqm.toFixed(2)}/m\u00B2`;
        pdf.text(rateLabel, colX[3], y, { align: 'right' });
      }

      pdf.text(`\u20AC ${space.monthly_rent.toFixed(2)}`, colX[4] - 2, y, {
        align: 'right',
      });
      totalMonthlyRent += space.monthly_rent;
      y += 7;
    });

    if (data.security_deposit > 0) {
      if (y > pageHeight - 40) {
        pdf.addPage();
        y = 20;
      }
      if (data.spaces.length % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, y - 4, pageWidth - 2 * margin, 7, 'F');
      }
      pdf.text('Voorschot Gas, Water & Electra', colX[0] + 2, y);
      pdf.text(
        `\u20AC ${data.security_deposit.toFixed(2)}`,
        colX[4] - 2,
        y,
        { align: 'right' }
      );
      y += 7;
    }

    y += 3;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(pageWidth - margin - 60, y, pageWidth - margin, y);
    y += 6;

    const grandTotal = totalMonthlyRent + data.security_deposit;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    pdf.text('Maandelijkse huurprijs:', margin, y);
    pdf.text(`\u20AC ${grandTotal.toFixed(2)}`, pageWidth - margin - 2, y, {
      align: 'right',
    });
    y += 5;

    const vatAmount = data.vat_inclusive
      ? grandTotal - grandTotal / (1 + data.vat_rate / 100)
      : grandTotal * (data.vat_rate / 100);
    const totalInclVat = data.vat_inclusive
      ? grandTotal
      : grandTotal + vatAmount;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text(
      `BTW (${data.vat_rate}%): \u20AC ${vatAmount.toFixed(2)}`,
      margin,
      y
    );
    y += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Totaal incl. BTW:', margin, y);
    pdf.text(
      `\u20AC ${totalInclVat.toFixed(2)}`,
      pageWidth - margin - 2,
      y,
      { align: 'right' }
    );
    y += 10;
  }

  // --- Betaalinformatie ---
  if (y > pageHeight - 50) {
    pdf.addPage();
    y = 20;
  }

  pdf.setFillColor(234, 179, 8);
  pdf.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('BETAALINFORMATIE', margin + 3, y + 5.5);
  y += 14;

  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);
  pdf.setFont('helvetica', 'normal');

  if (data.company) {
    pdf.text(
      'De maandelijkse huur dient bij vooruitbetaling te worden voldaan op:',
      margin,
      y
    );
    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`IBAN: ${data.company.iban}`, margin, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Ten name van: ${data.company.name}`, margin, y);
    y += 10;
  }

  // --- Ondertekening ---
  if (y > pageHeight - 70) {
    pdf.addPage();
    y = 20;
  }

  pdf.setFillColor(234, 179, 8);
  pdf.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('ONDERTEKENING', margin + 3, y + 5.5);
  y += 14;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  pdf.text(
    'Aldus in tweevoud opgemaakt en ondertekend te _________________ op ___ / ___ / ______',
    margin,
    y
  );
  y += 16;

  const colMid = pageWidth / 2;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Verhuurder:', margin, y);
  pdf.text('Huurder:', colMid + 10, y);
  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.company?.name || '', margin, y);
  pdf.text(data.tenant_company_name || data.tenant_name, colMid + 10, y);
  y += 20;

  pdf.setDrawColor(150, 150, 150);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, margin + 60, y);
  pdf.line(colMid + 10, y, colMid + 70, y);
  y += 4;
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text('Handtekening', margin, y);
  pdf.text('Handtekening', colMid + 10, y);

  // --- Footer ---
  pdf.setDrawColor(230, 230, 230);
  pdf.setLineWidth(0.3);
  pdf.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(120, 120, 120);

  if (data.company) {
    const footerY = pageHeight - 18;
    const line1 = `${data.company.name} | KvK: ${data.company.kvk} | BTW: ${data.company.btw}`;
    const line2 = `${data.company.address}, ${data.company.postal_code} ${data.company.city}`;
    let line3 = '';
    if (data.company.phone) line3 += `T: ${data.company.phone}`;
    if (data.company.email) line3 += ` | E: ${data.company.email}`;
    if (data.company.website) line3 += ` | W: ${data.company.website}`;

    pdf.text(line1, pageWidth / 2, footerY, { align: 'center' });
    pdf.text(line2, pageWidth / 2, footerY + 3, { align: 'center' });
    if (line3) {
      pdf.text(line3, pageWidth / 2, footerY + 6, { align: 'center' });
    }
  }
}

async function generateLeaseContractPDFDocument(
  data: LeaseContractData
): Promise<jsPDF> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  await buildLeaseContractPDF(pdf, data);
  return pdf;
}

export async function generateLeaseContractPDFBase64(
  data: LeaseContractData
): Promise<string> {
  const pdf = await generateLeaseContractPDFDocument(data);
  return pdf.output('datauristring').split(',')[1];
}

export async function generateLeaseContractPDFBlobUrl(
  data: LeaseContractData
): Promise<string> {
  const pdf = await generateLeaseContractPDFDocument(data);
  const blob = pdf.output('blob');
  return URL.createObjectURL(blob);
}

export async function generateLeaseContractPDF(
  data: LeaseContractData,
  skipDownload: boolean = false
): Promise<jsPDF> {
  const pdf = await generateLeaseContractPDFDocument(data);
  if (!skipDownload) {
    const tenantLabel = (
      data.tenant_company_name || data.tenant_name
    ).replace(/[<>:"/\\|?*]/g, '_');
    pdf.save(`Huurcontract_${tenantLabel}.pdf`);
  }
  return pdf;
}
