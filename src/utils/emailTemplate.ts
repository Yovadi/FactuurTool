import type { CompanySettings } from '../lib/supabase';

type InvoiceEmailData = {
  recipientName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  companySettings: CompanySettings;
};

export function buildInvoiceEmailHtml(data: InvoiceEmailData): string {
  const { recipientName, invoiceNumber, invoiceDate, dueDate, amount, companySettings } = data;
  const companyName = companySettings.company_name || '';
  const companyAddress = companySettings.address || '';
  const companyPostal = companySettings.postal_code || '';
  const companyCity = companySettings.city || '';
  const companyPhone = companySettings.phone || '';
  const companyEmail = companySettings.email || '';
  const companyIban = companySettings.bank_account || '';
  const companyKvk = companySettings.kvk_number || '';
  const companyBtw = companySettings.vat_number || '';

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<!-- Header -->
<tr>
<td style="background-color:#1a1a2e;padding:32px 40px;">
  <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${escapeHtml(companyName)}</h1>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:40px;">
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#333333;">Beste ${escapeHtml(recipientName)},</p>

  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#333333;">Hierbij ontvangt u factuur <strong>${escapeHtml(invoiceNumber)}</strong> van ${escapeHtml(companyName)}. De factuur is als PDF bijlage aan deze e-mail toegevoegd.</p>

  <!-- Invoice summary card -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fb;border-radius:8px;border:1px solid #e8eaed;margin-bottom:28px;">
  <tr>
  <td style="padding:24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:0 0 12px;border-bottom:1px solid #e8eaed;">
        <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888;font-weight:600;">Factuurnummer</span><br>
        <span style="font-size:15px;color:#1a1a2e;font-weight:600;">${escapeHtml(invoiceNumber)}</span>
      </td>
      <td style="padding:0 0 12px;border-bottom:1px solid #e8eaed;text-align:right;">
        <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888;font-weight:600;">Totaalbedrag</span><br>
        <span style="font-size:20px;color:#1a1a2e;font-weight:700;">${escapeHtml(amount)}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 0 0;">
        <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888;font-weight:600;">Factuurdatum</span><br>
        <span style="font-size:14px;color:#444;">${escapeHtml(invoiceDate)}</span>
      </td>
      <td style="padding:12px 0 0;text-align:right;">
        <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888;font-weight:600;">Vervaldatum</span><br>
        <span style="font-size:14px;color:#444;">${escapeHtml(dueDate)}</span>
      </td>
    </tr>
    </table>
  </td>
  </tr>
  </table>

  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#333333;">Gelieve het bedrag voor de vervaldatum over te maken naar:</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr>
    <td style="padding:4px 0;font-size:14px;color:#666;width:80px;">IBAN</td>
    <td style="padding:4px 0;font-size:14px;color:#1a1a2e;font-weight:600;">${escapeHtml(companyIban)}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;font-size:14px;color:#666;">t.n.v.</td>
    <td style="padding:4px 0;font-size:14px;color:#1a1a2e;font-weight:600;">${escapeHtml(companyName)}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;font-size:14px;color:#666;">Kenmerk</td>
    <td style="padding:4px 0;font-size:14px;color:#1a1a2e;font-weight:600;">${escapeHtml(invoiceNumber)}</td>
  </tr>
  </table>

  <p style="margin:0;font-size:15px;line-height:1.6;color:#333333;">Mocht u vragen hebben over deze factuur, neem dan gerust contact met ons op.</p>

  <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#333333;">Met vriendelijke groet,</p>
  <p style="margin:4px 0 0;font-size:15px;color:#1a1a2e;font-weight:600;">${escapeHtml(companyName)}</p>
</td>
</tr>

<!-- Footer / Signature -->
<tr>
<td style="padding:0 40px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8eaed;padding-top:24px;">
  <tr>
  <td>
    <p style="margin:0 0 4px;font-size:13px;color:#666;">${escapeHtml(companyAddress)}${companyPostal || companyCity ? `, ${escapeHtml(companyPostal)} ${escapeHtml(companyCity)}` : ''}</p>
    ${companyPhone ? `<p style="margin:0 0 4px;font-size:13px;color:#666;">Tel: ${escapeHtml(companyPhone)}</p>` : ''}
    ${companyEmail ? `<p style="margin:0 0 4px;font-size:13px;color:#666;">E-mail: <a href="mailto:${escapeHtml(companyEmail)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(companyEmail)}</a></p>` : ''}
    ${companyKvk ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">KVK: ${escapeHtml(companyKvk)}</p>` : ''}
    ${companyBtw ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">BTW: ${escapeHtml(companyBtw)}</p>` : ''}
  </td>
  </tr>
  </table>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export function buildInvoiceEmailText(data: InvoiceEmailData): string {
  const { recipientName, invoiceNumber, invoiceDate, dueDate, amount, companySettings } = data;

  return `Beste ${recipientName},

Hierbij ontvangt u factuur ${invoiceNumber} van ${companySettings.company_name}. De factuur is als PDF bijlage aan deze e-mail toegevoegd.

Factuurnummer: ${invoiceNumber}
Factuurdatum: ${invoiceDate}
Vervaldatum: ${dueDate}
Totaalbedrag: ${amount}

Gelieve het bedrag voor de vervaldatum over te maken naar:
IBAN: ${companySettings.bank_account}
t.n.v.: ${companySettings.company_name}
Kenmerk: ${invoiceNumber}

Mocht u vragen hebben over deze factuur, neem dan gerust contact met ons op.

Met vriendelijke groet,
${companySettings.company_name}
${companySettings.address}${companySettings.postal_code || companySettings.city ? `, ${companySettings.postal_code} ${companySettings.city}` : ''}
${companySettings.phone ? `Tel: ${companySettings.phone}` : ''}
${companySettings.email ? `E-mail: ${companySettings.email}` : ''}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
