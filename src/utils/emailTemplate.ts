import type { CompanySettings } from '../lib/supabase';

type InvoiceEmailData = {
  recipientName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  companySettings: CompanySettings;
};

type CreditNoteEmailData = {
  recipientName: string;
  creditNoteNumber: string;
  amount: string;
  reason: string;
  companySettings: CompanySettings;
};

const DEFAULT_INVOICE_SUBJECT = 'Factuur {factuurnummer} van {bedrijfsnaam}';
const DEFAULT_INVOICE_BODY = `Beste {naam},

Hierbij ontvangt u factuur {factuurnummer} van {bedrijfsnaam}. De factuur is als PDF bijlage aan deze e-mail toegevoegd.

Factuurnummer: {factuurnummer}
Bedrag: {bedrag}
Factuurdatum: {factuurdatum}
Vervaldatum: {vervaldatum}

Gelieve het bedrag voor de vervaldatum over te maken naar:
IBAN: {iban}
t.n.v.: {bedrijfsnaam}
Kenmerk: {factuurnummer}

Mocht u vragen hebben over deze factuur, neem dan gerust contact met ons op.

Met vriendelijke groet,
{bedrijfsnaam}`;

const DEFAULT_REMINDER_SUBJECT = 'Betalingsherinnering factuur {factuurnummer}';
const DEFAULT_REMINDER_BODY = `Beste {naam},

Uit onze administratie blijkt dat wij nog geen betaling hebben ontvangen voor onderstaande factuur:

Factuurnummer: {factuurnummer}
Bedrag: {bedrag}
Factuurdatum: {factuurdatum}
Vervaldatum: {vervaldatum}

Wij verzoeken u vriendelijk het openstaande bedrag zo spoedig mogelijk over te maken naar:
IBAN: {iban}
t.n.v.: {bedrijfsnaam}
Kenmerk: {factuurnummer}

Mocht u de betaling reeds hebben verricht, dan kunt u dit bericht als niet verstuurd beschouwen.

Met vriendelijke groet,
{bedrijfsnaam}`;

const DEFAULT_CREDIT_NOTE_SUBJECT = 'Credit nota {creditnotanummer} van {bedrijfsnaam}';
const DEFAULT_CREDIT_NOTE_BODY = `Beste {naam},

Hierbij ontvangt u credit nota {creditnotanummer} van {bedrijfsnaam}. De credit nota is als PDF bijlage aan deze e-mail toegevoegd.

Credit nota nummer: {creditnotanummer}
Bedrag: {bedrag}
Reden: {reden}

Het creditbedrag wordt verrekend met toekomstige facturen, of op verzoek teruggestort.

Mocht u vragen hebben, neem dan gerust contact met ons op.

Met vriendelijke groet,
{bedrijfsnaam}`;

function resolveInvoicePlaceholders(template: string, data: InvoiceEmailData): string {
  return template
    .replace(/{naam}/g, data.recipientName)
    .replace(/{factuurnummer}/g, data.invoiceNumber)
    .replace(/{bedrijfsnaam}/g, data.companySettings.company_name || '')
    .replace(/{bedrag}/g, data.amount)
    .replace(/{factuurdatum}/g, data.invoiceDate)
    .replace(/{vervaldatum}/g, data.dueDate)
    .replace(/{iban}/g, data.companySettings.bank_account || '');
}

function resolveCreditNotePlaceholders(template: string, data: CreditNoteEmailData): string {
  return template
    .replace(/{naam}/g, data.recipientName)
    .replace(/{creditnotanummer}/g, data.creditNoteNumber)
    .replace(/{bedrijfsnaam}/g, data.companySettings.company_name || '')
    .replace(/{bedrag}/g, data.amount)
    .replace(/{reden}/g, data.reason)
    .replace(/{iban}/g, data.companySettings.bank_account || '');
}

function getTemplate(custom: string | null | undefined, fallback: string): string {
  return custom && custom.trim() ? custom : fallback;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function wrapInEmailHtml(companySettings: CompanySettings, bodyText: string, signatureImage?: string | null): string {
  const companyName = companySettings.company_name || '';
  const companyAddress = companySettings.address || '';
  const companyPostal = companySettings.postal_code || '';
  const companyCity = companySettings.city || '';
  const companyPhone = companySettings.phone || '';
  const companyEmail = companySettings.email || '';
  const companyKvk = companySettings.kvk_number || '';
  const companyBtw = companySettings.vat_number || '';

  const bodyLines = bodyText.split('\n');
  const bodyHtml = bodyLines.map(line => {
    if (line.trim() === '') {
      return '<p style="margin:0;font-size:15px;line-height:1.6;color:#333333;">&nbsp;</p>';
    }
    return `<p style="margin:0;font-size:15px;line-height:1.6;color:#333333;">${escapeHtml(line)}</p>`;
  }).join('\n  ');

  const signatureImageHtml = signatureImage
    ? `<p style="margin:16px 0 0;"><img src="cid:signature-image" alt="${escapeHtml(companyName)}" style="max-height:100px;max-width:200px;height:auto;width:auto;" /></p>`
    : '';

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
  ${bodyHtml}
  ${signatureImageHtml}
</td>
</tr>

<!-- Footer -->
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

export function buildInvoiceEmailSubject(data: InvoiceEmailData): string {
  const template = getTemplate(data.companySettings.email_subject_template, DEFAULT_INVOICE_SUBJECT);
  return resolveInvoicePlaceholders(template, data);
}

export function buildInvoiceEmailHtml(data: InvoiceEmailData): string {
  const bodyTemplate = getTemplate(data.companySettings.email_template_invoice, DEFAULT_INVOICE_BODY);
  const bodyText = resolveInvoicePlaceholders(bodyTemplate, data);
  return wrapInEmailHtml(data.companySettings, bodyText, data.companySettings.email_signature_image);
}

export function buildInvoiceEmailText(data: InvoiceEmailData): string {
  const bodyTemplate = getTemplate(data.companySettings.email_template_invoice, DEFAULT_INVOICE_BODY);
  return resolveInvoicePlaceholders(bodyTemplate, data);
}

export function buildReminderEmailSubject(data: InvoiceEmailData): string {
  const template = getTemplate(data.companySettings.email_subject_reminder, DEFAULT_REMINDER_SUBJECT);
  return resolveInvoicePlaceholders(template, data);
}

export function buildReminderEmailHtml(data: InvoiceEmailData): string {
  const bodyTemplate = getTemplate(data.companySettings.email_template_reminder, DEFAULT_REMINDER_BODY);
  const bodyText = resolveInvoicePlaceholders(bodyTemplate, data);
  return wrapInEmailHtml(data.companySettings, bodyText, data.companySettings.email_signature_image);
}

export function buildReminderEmailText(data: InvoiceEmailData): string {
  const bodyTemplate = getTemplate(data.companySettings.email_template_reminder, DEFAULT_REMINDER_BODY);
  return resolveInvoicePlaceholders(bodyTemplate, data);
}

export function buildCreditNoteEmailSubject(data: CreditNoteEmailData): string {
  const template = getTemplate(data.companySettings.email_subject_credit_note, DEFAULT_CREDIT_NOTE_SUBJECT);
  return resolveCreditNotePlaceholders(template, data);
}

export function buildCreditNoteEmailHtml(data: CreditNoteEmailData): string {
  const bodyTemplate = getTemplate(data.companySettings.email_template_credit_note, DEFAULT_CREDIT_NOTE_BODY);
  const bodyText = resolveCreditNotePlaceholders(bodyTemplate, data);
  return wrapInEmailHtml(data.companySettings, bodyText, data.companySettings.email_signature_image);
}

export function buildCreditNoteEmailText(data: CreditNoteEmailData): string {
  const bodyTemplate = getTemplate(data.companySettings.email_template_credit_note, DEFAULT_CREDIT_NOTE_BODY);
  return resolveCreditNotePlaceholders(bodyTemplate, data);
}
