import { supabase } from '../lib/supabase';
import { generateInvoicePDF, generateCreditNotePDFDocument, type CreditNoteData } from './pdfGenerator';
import { generateLeaseContractPDF, type LeaseContractData } from './leaseContractPdf';
import { getEffectiveRootFolderPath } from './localSettings';

interface DiskFile {
  tenantFolder: string;
  year: string;
  fileName: string;
  category?: string;
  subFolder?: string;
}

export interface SyncResult {
  total: number;
  synced: number;
  skipped: number;
  failed: number;
  errors: string[];
}

type ProgressCallback = (current: number, total: number, label: string) => void;

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

function buildInvoiceFolderPath(rootPath: string, isExternal: boolean, companyName: string): string {
  const category = isExternal ? 'Externe huurders' : 'Huurders';
  const sanitized = sanitizeFolderName(companyName);
  const subFolder = isExternal ? '1. Facturen' : '2. Facturen';
  return `${rootPath}/${category}/${sanitized}/${subFolder}`;
}

function buildCreditNoteFolderPath(rootPath: string, isExternal: boolean, companyName: string): string {
  const category = isExternal ? 'Externe huurders' : 'Huurders';
  const sanitized = sanitizeFolderName(companyName);
  const subFolder = isExternal ? '2. Credit facturen' : '3. Credit facturen';
  return `${rootPath}/${category}/${sanitized}/${subFolder}`;
}

function buildLeaseContractFolderPath(rootPath: string, companyName: string): string {
  const sanitized = sanitizeFolderName(companyName);
  return `${rootPath}/Huurders/${sanitized}/1. Huurcontract`;
}

export async function syncInvoicePDFs(onProgress?: ProgressCallback): Promise<SyncResult | null> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.listInvoicesOnDisk || !electronAPI?.savePDF) {
    return null;
  }

  const { data: settings } = await supabase
    .from('company_settings')
    .select('root_folder_path, company_name, address, postal_code, city, kvk_number, vat_number, bank_account, email, phone')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!settings) {
    console.error('[syncInvoicePDFs] Bedrijfsinstellingen niet gevonden');
    return null;
  }

  const rootPath = await getEffectiveRootFolderPath(settings.root_folder_path);
  if (!rootPath) {
    console.log('[syncInvoicePDFs] Geen root folder pad geconfigureerd');
    return null;
  }

  console.log('[syncInvoicePDFs] Root path:', rootPath);

  const diskResult = await electronAPI.listInvoicesOnDisk(rootPath);
  const existingFiles = new Set<string>();
  if (diskResult.success && diskResult.files) {
    for (const f of diskResult.files as DiskFile[]) {
      existingFiles.add(f.fileName.toLowerCase());
    }
  }

  console.log('[syncInvoicePDFs] Bestaande bestanden op schijf:', existingFiles.size);

  const { data: invoices } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, invoice_date, due_date, invoice_month, notes,
      subtotal, amount, vat_amount, vat_rate, vat_inclusive, status,
      tenant_id, external_customer_id
    `)
    .in('status', ['sent', 'paid']);

  if (!invoices || invoices.length === 0) {
    console.log('[syncInvoicePDFs] Geen facturen met status sent/paid gevonden');
    return { total: 0, synced: 0, skipped: 0, failed: 0, errors: [] };
  }

  console.log('[syncInvoicePDFs] Facturen in database:', invoices.length);

  const missingInvoices = invoices.filter(inv => {
    const pdfName = `${inv.invoice_number}.pdf`.toLowerCase();
    return !existingFiles.has(pdfName);
  });

  console.log('[syncInvoicePDFs] Ontbrekende facturen:', missingInvoices.length);

  if (missingInvoices.length === 0) {
    return { total: invoices.length, synced: 0, skipped: invoices.length, failed: 0, errors: [] };
  }

  const tenantIds = [...new Set(missingInvoices.filter(i => i.tenant_id).map(i => i.tenant_id))];
  const externalIds = [...new Set(missingInvoices.filter(i => i.external_customer_id).map(i => i.external_customer_id))];

  console.log('[syncInvoicePDFs] Ophalen klantgegevens...', { tenantIds: tenantIds.length, externalIds: externalIds.length });

  const [tenantResult, externalResult] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from('tenants').select('id, name, company_name, email, phone, billing_address, street, postal_code, city, country').in('id', tenantIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    externalIds.length > 0
      ? supabase.from('external_customers').select('id, company_name, contact_name, email, phone, street, postal_code, city, country').in('id', externalIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (tenantResult.error) console.error('[syncInvoicePDFs] Fout bij ophalen huurders:', tenantResult.error);
  if (externalResult.error) console.error('[syncInvoicePDFs] Fout bij ophalen externe klanten:', externalResult.error);

  const tenants = tenantResult.data || [];
  const externals = externalResult.data || [];

  console.log('[syncInvoicePDFs] Klanten geladen:', { tenants: tenants.length, externals: externals.length });

  const tenantMap = new Map(tenants.map(t => [t.id, t]));
  const externalMap = new Map(externals.map(e => [e.id, e]));

  const invoiceIds = missingInvoices.map(i => i.id);
  const { data: allLineItems, error: lineItemsError } = await supabase
    .from('invoice_line_items')
    .select('*')
    .in('invoice_id', invoiceIds);

  if (lineItemsError) console.error('[syncInvoicePDFs] Fout bij ophalen regels:', lineItemsError);
  console.log('[syncInvoicePDFs] Factuurregels geladen:', allLineItems?.length ?? 0);

  const lineItemsByInvoice = new Map<string, any[]>();
  for (const item of (allLineItems || [])) {
    const existing = lineItemsByInvoice.get(item.invoice_id) || [];
    existing.push(item);
    lineItemsByInvoice.set(item.invoice_id, existing);
  }

  const result: SyncResult = { total: invoices.length, synced: 0, skipped: invoices.length - missingInvoices.length, failed: 0, errors: [] };

  console.log('[syncInvoicePDFs] Start opslaan van', missingInvoices.length, 'facturen...');

  for (let i = 0; i < missingInvoices.length; i++) {
    const invoice = missingInvoices[i];
    onProgress?.(i + 1, missingInvoices.length, invoice.invoice_number);

    try {
      const isExternal = !!invoice.external_customer_id;
      const tenant = isExternal
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
        },
      };

      const pdf = await generateInvoicePDF(invoiceData, false, true);
      const pdfBuffer = pdf.output('arraybuffer');
      const folderPath = buildInvoiceFolderPath(rootPath, isExternal, tenant.company_name || '');
      console.log(`[syncInvoicePDFs] Opslaan ${invoice.invoice_number} naar ${folderPath}`);
      const saveResult = await electronAPI.savePDF(pdfBuffer, folderPath, `${invoice.invoice_number}.pdf`);

      if (saveResult.success) {
        result.synced++;
      } else {
        console.error(`[syncInvoicePDFs] Fout bij opslaan ${invoice.invoice_number}:`, saveResult.error);
        result.failed++;
        result.errors.push(`${invoice.invoice_number}: ${saveResult.error}`);
      }
    } catch (err) {
      console.error(`[syncInvoicePDFs] Exception bij ${invoice.invoice_number}:`, err);
      result.failed++;
      result.errors.push(`${invoice.invoice_number}: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    }
  }

  console.log('[syncInvoicePDFs] Resultaat:', { synced: result.synced, failed: result.failed, errors: result.errors });
  return result;
}

export async function syncLeaseContractPDFs(onProgress?: ProgressCallback): Promise<SyncResult | null> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.savePDF || !electronAPI?.listInvoicesOnDisk) {
    return null;
  }

  const { data: settings } = await supabase
    .from('company_settings')
    .select('root_folder_path, company_name, address, postal_code, city, kvk_number, vat_number, bank_account, email, phone')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const rootPath = await getEffectiveRootFolderPath(settings?.root_folder_path);
  if (!rootPath) return null;

  const { data: leases } = await supabase
    .from('leases')
    .select(`
      id, start_date, end_date, vat_rate, vat_inclusive, security_deposit, lease_type,
      credits_per_week, flex_credit_rate, flex_day_type,
      tenant:tenants(id, name, company_name, email, phone, street, postal_code, city, country),
      lease_spaces:lease_spaces(
        id, price_per_sqm, monthly_rent,
        space:office_spaces(space_number, space_type, square_footage)
      )
    `)
    .in('status', ['active', 'expired']);

  if (!leases || leases.length === 0) {
    return { total: 0, synced: 0, skipped: 0, failed: 0, errors: [] };
  }

  const diskResult = await electronAPI.listInvoicesOnDisk(rootPath);
  const existingFiles = new Set<string>();
  if (diskResult.success && diskResult.files) {
    for (const f of diskResult.files as DiskFile[]) {
      existingFiles.add(f.fileName.toLowerCase());
    }
  }

  const missingLeases = leases.filter(lease => {
    const tenant = Array.isArray(lease.tenant) ? lease.tenant[0] : lease.tenant;
    if (!tenant) return false;
    const sanitizedName = (tenant.company_name || '').replace(/[<>:"/\\|?*]/g, '_').trim();
    const fileName = `Huurcontract_${sanitizedName}.pdf`.toLowerCase();
    return !existingFiles.has(fileName);
  });

  if (missingLeases.length === 0) {
    return { total: leases.length, synced: 0, skipped: leases.length, failed: 0, errors: [] };
  }

  const result: SyncResult = { total: leases.length, synced: 0, skipped: leases.length - missingLeases.length, failed: 0, errors: [] };

  for (let i = 0; i < missingLeases.length; i++) {
    const lease = missingLeases[i] as any;
    const tenant = Array.isArray(lease.tenant) ? lease.tenant[0] : lease.tenant;
    if (!tenant) {
      result.failed++;
      continue;
    }

    const sanitizedName = (tenant.company_name || '').replace(/[<>:"/\\|?*]/g, '_').trim();
    onProgress?.(i + 1, missingLeases.length, `Huurcontract ${sanitizedName}`);

    try {
      const leaseSpaces = (lease.lease_spaces || []).map((ls: any) => {
        const space = Array.isArray(ls.space) ? ls.space[0] : ls.space;
        return {
          space_number: space?.space_number || '',
          space_type: space?.space_type || '',
          square_footage: space?.square_footage || 0,
          price_per_sqm: ls.price_per_sqm || 0,
          monthly_rent: ls.monthly_rent || 0,
        };
      });

      const contractData: LeaseContractData = {
        tenant_name: tenant.name || tenant.company_name,
        tenant_company_name: tenant.company_name,
        tenant_street: tenant.street || undefined,
        tenant_postal_code: tenant.postal_code || undefined,
        tenant_city: tenant.city || undefined,
        tenant_country: tenant.country || undefined,
        tenant_email: tenant.email || undefined,
        tenant_phone: tenant.phone || undefined,
        lease_type: lease.lease_type || 'full_time',
        start_date: lease.start_date,
        end_date: lease.end_date,
        vat_rate: lease.vat_rate,
        vat_inclusive: lease.vat_inclusive,
        security_deposit: lease.security_deposit,
        spaces: leaseSpaces,
        company: settings ? {
          name: settings.company_name,
          address: settings.address,
          postal_code: settings.postal_code,
          city: settings.city,
          kvk: settings.kvk_number,
          btw: settings.vat_number,
          iban: settings.bank_account,
          email: settings.email || undefined,
          phone: settings.phone || undefined,
        } : undefined,
      };

      if (lease.lease_type === 'flex') {
        const flexSpace = leaseSpaces.length > 0 ? leaseSpaces[0] : null;
        contractData.flex = {
          credits_per_week: lease.credits_per_week || 0,
          flex_credit_rate: lease.flex_credit_rate || 0,
          flex_day_type: lease.flex_day_type || 'full_day',
          space_number: flexSpace?.space_number,
        };
      }

      const pdf = await generateLeaseContractPDF(contractData, true);
      const pdfBuffer = pdf.output('arraybuffer');
      const folderPath = buildLeaseContractFolderPath(rootPath, tenant.company_name || '');
      const fileName = `Huurcontract_${sanitizedName}.pdf`;
      const saveResult = await electronAPI.savePDF(pdfBuffer, folderPath, fileName);

      if (saveResult.success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push(`${fileName}: ${saveResult.error}`);
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`Huurcontract ${sanitizedName}: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    }
  }

  return result;
}

export async function syncCreditNotePDFs(onProgress?: ProgressCallback): Promise<SyncResult | null> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.listInvoicesOnDisk || !electronAPI?.savePDF) {
    return null;
  }

  const { data: settings } = await supabase
    .from('company_settings')
    .select('root_folder_path, company_name, address, postal_code, city, kvk_number, vat_number, bank_account, email, phone')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!settings) {
    console.error('[syncCreditNotePDFs] Bedrijfsinstellingen niet gevonden');
    return null;
  }

  const rootPath = await getEffectiveRootFolderPath(settings.root_folder_path);
  if (!rootPath) return null;

  const diskResult = await electronAPI.listInvoicesOnDisk(rootPath);
  const existingFiles = new Set<string>();
  if (diskResult.success && diskResult.files) {
    for (const f of diskResult.files as DiskFile[]) {
      existingFiles.add(f.fileName.toLowerCase());
    }
  }

  const { data: creditNotes } = await supabase
    .from('credit_notes')
    .select('id, credit_note_number, credit_date, reason, subtotal, vat_amount, vat_rate, total_amount, notes, status, tenant_id, external_customer_id')
    .in('status', ['sent', 'paid']);

  if (!creditNotes || creditNotes.length === 0) {
    return { total: 0, synced: 0, skipped: 0, failed: 0, errors: [] };
  }

  const missingNotes = creditNotes.filter(cn => {
    const pdfName = `${cn.credit_note_number}.pdf`.toLowerCase();
    return !existingFiles.has(pdfName);
  });

  if (missingNotes.length === 0) {
    return { total: creditNotes.length, synced: 0, skipped: creditNotes.length, failed: 0, errors: [] };
  }

  const tenantIds = [...new Set(missingNotes.filter(cn => cn.tenant_id).map(cn => cn.tenant_id))];
  const externalIds = [...new Set(missingNotes.filter(cn => cn.external_customer_id).map(cn => cn.external_customer_id))];

  const [tenantResult, externalResult] = await Promise.all([
    tenantIds.length > 0
      ? supabase.from('tenants').select('id, name, company_name, email, phone, billing_address, street, postal_code, city, country').in('id', tenantIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    externalIds.length > 0
      ? supabase.from('external_customers').select('id, company_name, contact_name, email, phone, street, postal_code, city, country').in('id', externalIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const tenantMap = new Map((tenantResult.data || []).map(t => [t.id, t]));
  const externalMap = new Map((externalResult.data || []).map(e => [e.id, e]));

  const noteIds = missingNotes.map(cn => cn.id);
  const { data: allLineItems } = await supabase
    .from('credit_note_line_items')
    .select('*')
    .in('credit_note_id', noteIds);

  const lineItemsByNote = new Map<string, any[]>();
  for (const item of (allLineItems || [])) {
    const existing = lineItemsByNote.get(item.credit_note_id) || [];
    existing.push(item);
    lineItemsByNote.set(item.credit_note_id, existing);
  }

  const result: SyncResult = { total: creditNotes.length, synced: 0, skipped: creditNotes.length - missingNotes.length, failed: 0, errors: [] };

  for (let i = 0; i < missingNotes.length; i++) {
    const cn = missingNotes[i];
    onProgress?.(i + 1, missingNotes.length, cn.credit_note_number);

    try {
      const isExternal = !!cn.external_customer_id;
      const customer = isExternal
        ? externalMap.get(cn.external_customer_id)
        : tenantMap.get(cn.tenant_id);

      if (!customer) {
        result.failed++;
        result.errors.push(`${cn.credit_note_number}: klant niet gevonden`);
        continue;
      }

      const customerName = customer.company_name || 'Onbekend';
      const customerAddress = cn.tenant_id
        ? (customer.billing_address || `${customer.street || ''}\n${customer.postal_code || ''} ${customer.city || ''}`)
        : `${customer.street || ''}\n${customer.postal_code || ''} ${customer.city || ''}`;

      const items = lineItemsByNote.get(cn.id) || [];

      const pdfData: CreditNoteData = {
        credit_note_number: cn.credit_note_number,
        credit_date: cn.credit_date,
        reason: cn.reason,
        customer_name: customerName,
        customer_address: customerAddress,
        line_items: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
        })),
        subtotal: cn.subtotal,
        vat_amount: cn.vat_amount,
        vat_rate: cn.vat_rate,
        total_amount: cn.total_amount,
        notes: cn.notes,
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

      const pdf = await generateCreditNotePDFDocument(pdfData);
      const pdfBuffer = pdf.output('arraybuffer');
      const folderPath = buildCreditNoteFolderPath(rootPath, isExternal, customerName);
      const saveResult = await electronAPI.savePDF(pdfBuffer, folderPath, `${cn.credit_note_number}.pdf`);

      if (saveResult.success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push(`${cn.credit_note_number}: ${saveResult.error}`);
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`${cn.credit_note_number}: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    }
  }

  return result;
}

export { buildInvoiceFolderPath, buildCreditNoteFolderPath, buildLeaseContractFolderPath };

let periodicSyncTimer: ReturnType<typeof setInterval> | null = null;

export function startPeriodicSync(
  onSyncStart?: () => void,
  onInvoiceProgress?: ProgressCallback,
  onLeaseProgress?: ProgressCallback,
  onSyncComplete?: (invoiceResult: SyncResult | null, leaseResult: SyncResult | null) => void,
  intervalMs: number = 5 * 60 * 1000
): () => void {
  if (periodicSyncTimer) {
    clearInterval(periodicSyncTimer);
  }

  const runSync = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.savePDF) return;

    const invoiceResult = await syncInvoicePDFs(onInvoiceProgress);
    const creditNoteResult = await syncCreditNotePDFs();
    const leaseResult = await syncLeaseContractPDFs(onLeaseProgress);

    const hasChanges =
      (invoiceResult && invoiceResult.synced > 0) ||
      (creditNoteResult && creditNoteResult.synced > 0) ||
      (leaseResult && leaseResult.synced > 0);

    if (hasChanges) {
      onSyncStart?.();
      onSyncComplete?.(invoiceResult, leaseResult);
    }
  };

  periodicSyncTimer = setInterval(runSync, intervalMs);

  return () => {
    if (periodicSyncTimer) {
      clearInterval(periodicSyncTimer);
      periodicSyncTimer = null;
    }
  };
}
