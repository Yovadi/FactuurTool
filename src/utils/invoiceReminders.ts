import { supabase } from '../lib/supabase';
import { generateInvoicePDFBase64, type InvoiceData } from './pdfGenerator';
import { isEmailConfigured, sendEmail } from './emailSender';
import {
  buildReminderEmailHtml,
  buildReminderEmailSubject,
  buildReminderEmailText,
} from './emailTemplate';
import { logAudit } from './auditLog';

function mapLineItemsToSpaces(items: Array<{ description: string; amount: number; quantity: number | null; unit_price: number }>): InvoiceData['spaces'] {
  return items.map(item => {
    let spaceType = 'diversen';
    if (item.description.toLowerCase().includes('voorschot')) spaceType = 'voorschot';
    else if (item.description.startsWith('Hal ')) spaceType = 'bedrijfsruimte';
    else if (item.description.startsWith('Kantoor ')) spaceType = 'kantoor';
    else if (item.description.startsWith('Buitenterrein ')) spaceType = 'buitenterrein';
    return {
      space_name: item.description,
      monthly_rent: item.amount,
      space_type: spaceType,
      square_footage: item.quantity || undefined,
      price_per_sqm: item.unit_price,
    };
  });
}

export async function sendInvoiceReminderEmails(limit = 25, invoiceId?: string): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const result = { sent: 0, skipped: 0, errors: [] as string[] };
  const { data: settings } = await supabase.from('company_settings').select('*').maybeSingle();
  if (!settings || !isEmailConfigured(settings)) {
    result.errors.push('Geen e-mailmethode geconfigureerd');
    return result;
  }

  const today = new Date().toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('invoices')
    .select('*, tenant:tenants(*), external_customer:external_customers(*), line_items:invoice_line_items(*)')
    .in('status', ['sent', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(limit);

  if (invoiceId) {
    query = query.eq('id', invoiceId);
  } else {
    query = query.lte('due_date', today);
  }

  const { data: invoices } = await query;

  for (const invoice of invoices || []) {
    if (!invoiceId && invoice.last_reminder_sent_at && invoice.last_reminder_sent_at > fourteenDaysAgo) {
      result.skipped++;
      continue;
    }
    const customer = invoice.tenant || invoice.external_customer;
    if (!customer?.email) {
      result.skipped++;
      continue;
    }

    const invoiceData: InvoiceData = {
      invoice_number: invoice.invoice_number,
      tenant_name: customer.name || customer.contact_name,
      tenant_contact_name: customer.contact_name,
      tenant_company_name: customer.company_name || '',
      tenant_email: customer.email,
      tenant_phone: customer.phone || undefined,
      tenant_street: customer.street || undefined,
      tenant_postal_code: customer.postal_code || undefined,
      tenant_city: customer.city || undefined,
      tenant_country: customer.country || undefined,
      invoice_month: invoice.invoice_month || undefined,
      notes: invoice.notes || undefined,
      spaces: mapLineItemsToSpaces(invoice.line_items || []),
      subtotal: invoice.subtotal,
      amount: invoice.amount,
      vat_amount: invoice.vat_amount,
      vat_rate: invoice.vat_rate,
      vat_inclusive: invoice.vat_inclusive,
      due_date: invoice.due_date,
      invoice_date: invoice.invoice_date,
      company: {
        name: settings.company_name,
        address: settings.address,
        postal_code: settings.postal_code,
        city: settings.city,
        kvk: settings.kvk_number,
        btw: settings.vat_number,
        iban: settings.bank_account,
        email: settings.email,
        phone: settings.phone,
      },
    };

    try {
      const pdfBase64 = await generateInvoicePDFBase64(invoiceData);
      const recipientName = customer.name || customer.contact_name || customer.company_name || '';
      const emailData = {
        recipientName,
        invoiceNumber: invoice.invoice_number.replace(/^INV-/, ''),
        invoiceDate: new Date(invoice.invoice_date).toLocaleDateString('nl-NL'),
        dueDate: new Date(invoice.due_date).toLocaleDateString('nl-NL'),
        amount: `€${Number(invoice.amount).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`,
        companySettings: settings,
      };
      const sendResult = await sendEmail(settings, {
        to: customer.email,
        toName: recipientName,
        subject: buildReminderEmailSubject(emailData),
        body: buildReminderEmailText(emailData),
        html: buildReminderEmailHtml(emailData),
        attachmentBase64: pdfBase64,
        attachmentName: `${invoice.invoice_number}.pdf`,
        invoiceId: invoice.id,
      });
      if (!sendResult.success) {
        result.errors.push(`${invoice.invoice_number}: ${sendResult.error || 'verzenden mislukt'}`);
        continue;
      }
      await supabase
        .from('invoices')
        .update({
          last_reminder_sent_at: new Date().toISOString(),
          reminder_count: (invoice.reminder_count || 0) + 1,
        })
        .eq('id', invoice.id);
      await logAudit('reminder_sent', 'invoice', invoice.id, customer.email);
      result.sent++;
    } catch (error) {
      result.errors.push(`${invoice.invoice_number}: ${error instanceof Error ? error.message : 'onbekende fout'}`);
    }
  }

  return result;
}
