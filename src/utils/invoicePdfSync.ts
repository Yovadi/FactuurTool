import { supabase } from '../lib/supabase';
import { generateInvoicePDF } from './pdfGenerator';
import { getEffectiveRootFolderPath } from './localSettings';

interface DiskFile {
  tenantFolder: string;
  year: string;
  fileName: string;
}

interface SyncResult {
  total: number;
  synced: number;
  skipped: number;
  failed: number;
  errors: string[];
}

type ProgressCallback = (current: number, total: number, invoiceNumber: string) => void;

export async function syncInvoicePDFs(onProgress?: ProgressCallback): Promise<SyncResult | null> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.listInvoicesOnDisk || !electronAPI?.savePDF) return null;

  const { data: settings } = await supabase
    .from('company_settings')
    .select('root_folder_path, company_name, address, postal_code, city, kvk_number, vat_number, bank_account, email, phone, website')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const rootPath = await getEffectiveRootFolderPath(settings?.root_folder_path);
  if (!rootPath) return null;

  const diskResult = await electronAPI.listInvoicesOnDisk(rootPath);
  if (!diskResult.success) return null;

  const existingFiles = new Set(
    (diskResult.files as DiskFile[]).map(f => f.fileName.toLowerCase())
  );

  const { data: invoices } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, invoice_date, due_date, invoice_month, notes,
      subtotal, amount, vat_amount, vat_rate, vat_inclusive, status,
      tenant_id, external_customer_id
    `)
    .in('status', ['sent', 'paid']);

  if (!invoices || invoices.length === 0) return { total: 0, synced: 0, skipped: 0, failed: 0, errors: [] };

  const missingInvoices = invoices.filter(inv => {
    const pdfName = `${inv.invoice_number}.pdf`.toLowerCase();
    return !existingFiles.has(pdfName);
  });

  if (missingInvoices.length === 0) {
    return { total: invoices.length, synced: 0, skipped: invoices.length, failed: 0, errors: [] };
  }

  const tenantIds = [...new Set(missingInvoices.filter(i => i.tenant_id).map(i => i.tenant_id))];
  const externalIds = [...new Set(missingInvoices.filter(i => i.external_customer_id).map(i => i.external_customer_id))];

  const [{ data: tenants }, { data: externals }] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from('tenants').select('id, name, contact_name, company_name, email, phone, billing_address, street, postal_code, city, country').in('id', tenantIds)
      : Promise.resolve({ data: [] }),
    externalIds.length > 0
      ? supabase.from('external_customers').select('id, company_name, contact_name, email, phone, street, postal_code, city, country').in('id', externalIds)
      : Promise.resolve({ data: [] }),
  ]);

  const tenantMap = new Map((tenants || []).map(t => [t.id, t]));
  const externalMap = new Map((externals || []).map(e => [e.id, e]));

  const invoiceIds = missingInvoices.map(i => i.id);
  const { data: allLineItems } = await supabase
    .from('invoice_line_items')
    .select('*')
    .in('invoice_id', invoiceIds);

  const lineItemsByInvoice = new Map<string, any[]>();
  for (const item of (allLineItems || [])) {
    const existing = lineItemsByInvoice.get(item.invoice_id) || [];
    existing.push(item);
    lineItemsByInvoice.set(item.invoice_id, existing);
  }

  const result: SyncResult = { total: invoices.length, synced: 0, skipped: invoices.length - missingInvoices.length, failed: 0, errors: [] };

  for (let i = 0; i < missingInvoices.length; i++) {
    const invoice = missingInvoices[i];
    onProgress?.(i + 1, missingInvoices.length, invoice.invoice_number);

    try {
      const tenant = invoice.external_customer_id
        ? externalMap.get(invoice.external_customer_id)
        : tenantMap.get(invoice.tenant_id);

      if (!tenant) {
        result.failed++;
        result.errors.push(`${invoice.invoice_number}: klant niet gevonden`);
        continue;
      }

      const items = lineItemsByInvoice.get(invoice.id) || [];
      const spaces = items.map(item => {
        let spaceType = 'diversen';
        if (item.description.toLowerCase().includes('voorschot')) spaceType = 'voorschot';
        else if (item.description.startsWith('Hal ')) spaceType = 'bedrijfsruimte';
        else if (item.description.startsWith('Kantoor ')) spaceType = 'kantoor';
        else if (item.description.startsWith('Buitenterrein ')) spaceType = 'buitenterrein';

        let squareFootage: number | undefined;
        if (spaceType !== 'voorschot' && spaceType !== 'diversen' && item.quantity != null) {
          const parsed = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
          if (!isNaN(parsed) && parsed > 0) squareFootage = parsed;
        }

        return {
          space_name: item.description,
          monthly_rent: item.amount,
          space_type: spaceType,
          square_footage: squareFootage,
          price_per_sqm: item.unit_price,
        };
      });

      const invoiceData = {
        invoice_number: invoice.invoice_number,
        tenant_name: ('name' in tenant) ? tenant.name : undefined,
        tenant_contact_name: ('contact_name' in tenant) ? tenant.contact_name : undefined,
        tenant_company_name: tenant.company_name || '',
        tenant_email: tenant.email || '',
        tenant_phone: tenant.phone || undefined,
        tenant_billing_address: ('billing_address' in tenant) ? tenant.billing_address : undefined,
        tenant_street: tenant.street || undefined,
        tenant_postal_code: tenant.postal_code || undefined,
        tenant_city: tenant.city || undefined,
        tenant_country: tenant.country || undefined,
        invoice_month: invoice.invoice_month || undefined,
        notes: invoice.notes || undefined,
        spaces,
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
          website: settings.website,
        },
      };

      const pdf = await generateInvoicePDF(invoiceData, false, true);
      const pdfBuffer = pdf.output('arraybuffer');
      const invoiceYear = new Date(invoice.invoice_date).getFullYear().toString();
      const tenantFolderPath = `${rootPath}/${tenant.company_name}/${invoiceYear}`;
      const saveResult = await electronAPI.savePDF(pdfBuffer, tenantFolderPath, `${invoice.invoice_number}.pdf`);

      if (saveResult.success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push(`${invoice.invoice_number}: ${saveResult.error}`);
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`${invoice.invoice_number}: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    }
  }

  return result;
}
