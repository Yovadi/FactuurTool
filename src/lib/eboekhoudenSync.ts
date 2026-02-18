import { supabase } from './supabase';
import type { Invoice, InvoiceLineItem, Tenant, ExternalCustomer, CompanySettings, PurchaseInvoice, PurchaseInvoiceLineItem, CreditNote, CreditNoteLineItem } from './supabase';
import { createRelation, getRelation, updateRelation, createInvoice as ebCreateInvoice, createMutation, getInvoice as ebGetInvoice, getMutation as ebGetMutation } from './eboekhouden';

const VAT_CODE_MAP: Record<number, string> = {
  21: 'HOOG_VERK_21',
  9: 'LAAG_VERK_9',
  0: 'GEEN',
};

const VAT_CODE_PURCHASE_MAP: Record<number, string> = {
  21: 'HOOG_INK_21',
  9: 'LAAG_INK_9',
  0: 'GEEN',
};

function getVatCode(vatRate: number): string {
  return VAT_CODE_MAP[vatRate] || 'HOOG_VERK_21';
}

async function logSync(
  entityType: string,
  entityId: string,
  action: string,
  status: string,
  eboekhoudenId?: number | null,
  errorMessage?: string | null,
  requestPayload?: unknown,
  responsePayload?: unknown
) {
  await supabase.from('eboekhouden_sync_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    eboekhouden_id: eboekhoudenId || null,
    action,
    status,
    error_message: errorMessage || null,
    request_payload: requestPayload || null,
    response_payload: responsePayload || null,
  });
}

export async function syncRelationToEBoekhouden(
  apiToken: string,
  customer: Tenant | ExternalCustomer,
  customerType: 'tenant' | 'external',
  force = false,
  code?: string
): Promise<{ success: boolean; relationId?: number; error?: string }> {
  const isExternal = customerType === 'external';
  const table = isExternal ? 'external_customers' : 'tenants';
  const entityType = isExternal ? 'external_relation' : 'tenant_relation';

  const existingRelationId = customer.eboekhouden_relatie_id;

  if (existingRelationId && force) {
    const checkResult = await getRelation(apiToken, existingRelationId);
    if (checkResult.success) {
      const contactName = isExternal
        ? (customer as ExternalCustomer).contact_name
        : (customer as Tenant).name;
      const updateData: Record<string, unknown> = {
        name: customer.company_name || contactName || '',
        contact: contactName || '',
        emailAddress: customer.email || '',
        phoneNumber: customer.phone || '',
        address: customer.street || '',
        postalCode: customer.postal_code || '',
        city: customer.city || '',
        country: customer.country || 'NL',
      };
      if (code) updateData.code = code;
      await updateRelation(apiToken, existingRelationId, updateData);
      await logSync(entityType, customer.id, 'update', 'success', existingRelationId, null, updateData, null);
      return { success: true, relationId: existingRelationId };
    }
  }

  if (existingRelationId && !force) {
    return { success: true, relationId: existingRelationId };
  }

  const contactName = isExternal
    ? (customer as ExternalCustomer).contact_name
    : (customer as Tenant).name;

  const relationData: Record<string, unknown> = {
    type: 'B',
    name: customer.company_name || contactName || '',
    contact: contactName || '',
    emailAddress: customer.email || '',
    phoneNumber: customer.phone || '',
    address: customer.street || '',
    postalCode: customer.postal_code || '',
    city: customer.city || '',
    country: customer.country || 'NL',
  };
  if (code) relationData.code = code;

  const result = await createRelation(apiToken, relationData);

  if (!result.success) {
    await logSync(entityType, customer.id, 'create', 'error', null, JSON.stringify(result.data), relationData, result.data);
    return { success: false, error: 'Kon relatie niet aanmaken in e-Boekhouden' };
  }

  const responseData = result.data as any;
  const relationId = typeof responseData?.id === 'number' ? responseData.id
    : typeof responseData?.Id === 'number' ? responseData.Id
    : parseInt(responseData?.id || responseData?.Id, 10) || null;

  if (relationId) {
    await supabase
      .from(table)
      .update({ eboekhouden_relatie_id: relationId })
      .eq('id', customer.id);

    await logSync(entityType, customer.id, 'create', 'success', relationId, null, relationData, result.data);
  }

  return { success: true, relationId };
}

export async function syncInvoiceToEBoekhouden(
  apiToken: string,
  invoice: Invoice & { line_items?: InvoiceLineItem[] },
  customer: Tenant | ExternalCustomer,
  customerType: 'tenant' | 'external',
  settings: CompanySettings
): Promise<{ success: boolean; error?: string }> {
  if (invoice.eboekhouden_factuur_id) {
    return { success: true };
  }

  const relationResult = await syncRelationToEBoekhouden(apiToken, customer, customerType);
  if (!relationResult.success || !relationResult.relationId) {
    return { success: false, error: relationResult.error || 'Relatie kon niet worden gesynchroniseerd' };
  }

  const { data: mappings } = await supabase
    .from('eboekhouden_grootboek_mapping')
    .select('*');

  const defaultMapping = mappings?.find(m => m.local_category === 'default');
  const defaultLedgerId = defaultMapping?.grootboek_id;

  if (!defaultLedgerId) {
    return { success: false, error: 'Geen grootboekrekening geconfigureerd. Stel een "Standaard" mapping in bij e-Boekhouden instellingen.' };
  }

  const lineItems = invoice.line_items || [];
  const items = lineItems.map(item => {
    let ledgerId = defaultLedgerId;
    let source = 'default';

    // First priority: manually set grootboek_id on the line item
    if (item.grootboek_id) {
      ledgerId = item.grootboek_id;
      source = 'manual';
      console.log(`[Invoice Sync] Line item "${item.description}" -> MANUAL grootboek: ${ledgerId}`);
    }
    // Second priority: category mapping
    else if (item.local_category) {
      const categoryMapping = mappings?.find(m => m.local_category === item.local_category);
      if (categoryMapping?.grootboek_id) {
        ledgerId = categoryMapping.grootboek_id;
        source = `category:${item.local_category}`;
        console.log(`[Invoice Sync] Line item "${item.description}" -> category: ${item.local_category}, ledger: ${ledgerId}`);
      } else {
        console.log(`[Invoice Sync] Line item "${item.description}" -> category: ${item.local_category} NOT FOUND in mappings, using default: ${ledgerId}`);
      }
    } else {
      console.log(`[Invoice Sync] Line item "${item.description}" -> NO category, using default: ${ledgerId}`);
    }

    return {
      description: item.description,
      quantity: 1,
      pricePerUnit: item.amount,
      vatCode: getVatCode(invoice.vat_rate),
      ledgerId,
    };
  });

  if (items.length === 0) {
    items.push({
      description: `Factuur ${invoice.invoice_number}`,
      quantity: 1,
      pricePerUnit: invoice.subtotal,
      vatCode: getVatCode(invoice.vat_rate),
      ledgerId: defaultLedgerId,
    });
  }

  const dueDate = new Date(invoice.due_date);
  const invoiceDate = new Date(invoice.invoice_date);
  const termDays = Math.max(0, Math.round((dueDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)));

  const invoiceData: Record<string, unknown> = {
    relationId: relationResult.relationId,
    date: invoice.invoice_date,
    termOfPayment: termDays,
    invoiceNumber: invoice.invoice_number,
    inExVat: invoice.vat_inclusive ? 'IN' : 'EX',
    items,
  };

  if (settings.eboekhouden_template_id) {
    invoiceData.templateId = settings.eboekhouden_template_id;
  }

  const result = await ebCreateInvoice(apiToken, invoiceData);

  if (!result.success) {
    await logSync('invoice', invoice.id, 'create', 'error', null, JSON.stringify(result.data), invoiceData, result.data);
    return { success: false, error: 'Kon factuur niet aanmaken in e-Boekhouden' };
  }

  const responseData = result.data as any;
  const factuurId = responseData?.id || responseData?.Id;

  if (factuurId) {
    await supabase
      .from('invoices')
      .update({
        eboekhouden_factuur_id: factuurId,
        eboekhouden_synced_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);
  }

  await logSync('invoice', invoice.id, 'create', 'success', factuurId, null, invoiceData, result.data);

  return { success: true };
}

function getPurchaseVatCode(vatRate: number): string {
  return VAT_CODE_PURCHASE_MAP[vatRate] || 'HOOG_INK_21';
}

async function syncSupplierAsRelation(
  apiToken: string,
  invoice: PurchaseInvoice
): Promise<{ success: boolean; relationId?: number; error?: string }> {
  if (invoice.eboekhouden_relatie_id) {
    return { success: true, relationId: invoice.eboekhouden_relatie_id };
  }

  const relationData: Record<string, unknown> = {
    type: 'B',
    name: invoice.supplier_name || '',
    contact: '',
    emailAddress: '',
    phoneNumber: '',
    address: invoice.supplier_address || '',
    postalCode: invoice.supplier_postal_code || '',
    city: invoice.supplier_city || '',
    country: invoice.supplier_country || 'NL',
  };

  const result = await createRelation(apiToken, relationData);

  if (!result.success) {
    await logSync('supplier_relation', invoice.id, 'create', 'error', null, JSON.stringify(result.data), relationData, result.data);
    return { success: false, error: 'Kon leverancier niet aanmaken als relatie in e-Boekhouden' };
  }

  const responseData = result.data as any;
  const relationId = responseData?.id || responseData?.Id;

  if (relationId) {
    await supabase
      .from('purchase_invoices')
      .update({ eboekhouden_relatie_id: relationId })
      .eq('id', invoice.id);

    await logSync('supplier_relation', invoice.id, 'create', 'success', relationId, null, relationData, result.data);
  }

  return { success: true, relationId };
}

export async function syncPurchaseInvoiceToEBoekhouden(
  apiToken: string,
  invoice: PurchaseInvoice & { purchase_invoice_line_items?: PurchaseInvoiceLineItem[] },
  settings: CompanySettings
): Promise<{ success: boolean; error?: string }> {
  if (invoice.eboekhouden_factuur_id) {
    return { success: true };
  }

  const relationResult = await syncSupplierAsRelation(apiToken, invoice);
  if (!relationResult.success || !relationResult.relationId) {
    return { success: false, error: relationResult.error || 'Leverancier kon niet worden gesynchroniseerd' };
  }

  const { data: mappings } = await supabase
    .from('eboekhouden_grootboek_mapping')
    .select('*');

  const categoryKey = `inkoop_${invoice.category}`;
  const categoryMapping = mappings?.find(m => m.local_category === categoryKey);
  const defaultMapping = mappings?.find(m => m.local_category === 'inkoop_default') || mappings?.find(m => m.local_category === 'default');
  const ledgerId = categoryMapping?.grootboek_id || defaultMapping?.grootboek_id;

  if (categoryMapping?.grootboek_id) {
    console.log(`[Purchase Invoice Sync] Category "${categoryKey}" found, ledger: ${ledgerId}`);
  } else {
    console.log(`[Purchase Invoice Sync] Category "${categoryKey}" NOT FOUND, using default/inkoop_default: ${ledgerId}`);
  }

  if (!ledgerId) {
    return { success: false, error: 'Geen grootboekrekening geconfigureerd. Stel een "Inkoop - Standaard" of "Standaard" mapping in bij e-Boekhouden instellingen.' };
  }

  const lineItems = invoice.purchase_invoice_line_items || [];
  const items = lineItems.map(item => {
    // Use line-specific grootboek_id if set, otherwise use the invoice-level ledgerId
    const itemLedgerId = item.grootboek_id || ledgerId;

    if (item.grootboek_id) {
      console.log(`[Purchase Invoice Sync] Line item "${item.description}" -> MANUAL grootboek: ${itemLedgerId}`);
    } else {
      console.log(`[Purchase Invoice Sync] Line item "${item.description}" -> using invoice category ledger: ${itemLedgerId}`);
    }

    return {
      description: item.description,
      quantity: 1,
      pricePerUnit: item.amount,
      vatCode: getPurchaseVatCode(item.vat_rate || invoice.vat_rate),
      ledgerId: itemLedgerId,
    };
  });

  if (items.length === 0) {
    items.push({
      description: `Inkoopfactuur ${invoice.invoice_number} - ${invoice.supplier_name}`,
      quantity: 1,
      pricePerUnit: invoice.subtotal,
      vatCode: getPurchaseVatCode(invoice.vat_rate),
      ledgerId,
    });
  }

  const mutationData = {
    relationId: relationResult.relationId,
    date: invoice.invoice_date,
    invoiceNumber: invoice.invoice_number,
    description: `Inkoopfactuur ${invoice.invoice_number} - ${invoice.supplier_name}`,
    items,
  };

  const result = await createMutation(apiToken, mutationData);

  if (!result.success) {
    await logSync('purchase_invoice', invoice.id, 'create', 'error', null, JSON.stringify(result.data), mutationData, result.data);
    return { success: false, error: 'Kon inkoopfactuur niet aanmaken in e-Boekhouden' };
  }

  const responseData = result.data as any;
  const mutationId = responseData?.id || responseData?.Id;

  if (mutationId) {
    await supabase
      .from('purchase_invoices')
      .update({
        eboekhouden_factuur_id: mutationId,
        eboekhouden_synced_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);
  }

  await logSync('purchase_invoice', invoice.id, 'create', 'success', mutationId, null, mutationData, result.data);

  return { success: true };
}

export async function syncCreditNoteToEBoekhouden(
  apiToken: string,
  creditNote: CreditNote & { credit_note_line_items?: CreditNoteLineItem[] },
  customer: Tenant | ExternalCustomer,
  customerType: 'tenant' | 'external',
  settings: CompanySettings
): Promise<{ success: boolean; error?: string }> {
  if (creditNote.eboekhouden_id) {
    return { success: true };
  }

  const relationResult = await syncRelationToEBoekhouden(apiToken, customer, customerType);
  if (!relationResult.success || !relationResult.relationId) {
    return { success: false, error: relationResult.error || 'Relatie kon niet worden gesynchroniseerd' };
  }

  const { data: mappings } = await supabase
    .from('eboekhouden_grootboek_mapping')
    .select('*');

  const defaultMapping = mappings?.find(m => m.local_category === 'default');
  const defaultLedgerId = defaultMapping?.grootboek_id;

  if (!defaultLedgerId) {
    return { success: false, error: 'Geen grootboekrekening geconfigureerd. Stel een "Standaard" mapping in bij e-Boekhouden instellingen.' };
  }

  const lineItems = creditNote.credit_note_line_items || [];
  const items = lineItems.map(item => {
    // Use line-specific grootboek_id if set, otherwise use default
    const itemLedgerId = item.grootboek_id || defaultLedgerId;

    if (item.grootboek_id) {
      console.log(`[Credit Note Sync] Line item "${item.description}" -> MANUAL grootboek: ${itemLedgerId}`);
    } else {
      console.log(`[Credit Note Sync] Line item "${item.description}" -> using default ledger: ${itemLedgerId}`);
    }

    return {
      description: item.description,
      quantity: 1,
      pricePerUnit: -Math.abs(item.amount),
      vatCode: getVatCode(creditNote.vat_rate),
      ledgerId: itemLedgerId,
    };
  });

  if (items.length === 0) {
    items.push({
      description: `Creditnota ${creditNote.credit_note_number}`,
      quantity: 1,
      pricePerUnit: -Math.abs(creditNote.subtotal),
      vatCode: getVatCode(creditNote.vat_rate),
      ledgerId: defaultLedgerId,
    });
  }

  const invoiceData: Record<string, unknown> = {
    relationId: relationResult.relationId,
    date: creditNote.credit_date,
    termOfPayment: 0,
    invoiceNumber: creditNote.credit_note_number,
    inExVat: 'EX',
    items,
  };

  if (settings.eboekhouden_template_id) {
    invoiceData.templateId = settings.eboekhouden_template_id;
  }

  const result = await ebCreateInvoice(apiToken, invoiceData);

  if (!result.success) {
    await logSync('credit_note', creditNote.id, 'create', 'error', null, JSON.stringify(result.data), invoiceData, result.data);
    return { success: false, error: 'Kon creditnota niet aanmaken in e-Boekhouden' };
  }

  const responseData = result.data as any;
  const factuurId = responseData?.id || responseData?.Id;

  if (factuurId) {
    await supabase
      .from('credit_notes')
      .update({
        eboekhouden_id: factuurId,
        eboekhouden_synced_at: new Date().toISOString(),
      })
      .eq('id', creditNote.id);
  }

  await logSync('credit_note', creditNote.id, 'create', 'success', factuurId, null, invoiceData, result.data);

  return { success: true };
}

export interface VerificationResult {
  invoicesChecked: number;
  invoicesNotFound: number;
  creditNotesChecked: number;
  creditNotesNotFound: number;
  purchaseInvoicesChecked: number;
  purchaseInvoicesNotFound: number;
  errors: string[];
}

export async function verifyInvoiceSyncStatus(
  apiToken: string
): Promise<VerificationResult> {
  const result: VerificationResult = {
    invoicesChecked: 0,
    invoicesNotFound: 0,
    creditNotesChecked: 0,
    creditNotesNotFound: 0,
    purchaseInvoicesChecked: 0,
    purchaseInvoicesNotFound: 0,
    errors: [],
  };

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, eboekhouden_factuur_id')
    .not('eboekhouden_factuur_id', 'is', null);

  for (const inv of invoices || []) {
    result.invoicesChecked++;
    try {
      const check = await ebGetInvoice(apiToken, inv.eboekhouden_factuur_id);
      if (!check.success) {
        result.invoicesNotFound++;
        await supabase
          .from('invoices')
          .update({ eboekhouden_factuur_id: null, eboekhouden_synced_at: null })
          .eq('id', inv.id);
        await logSync('invoice', inv.id, 'verify', 'error', inv.eboekhouden_factuur_id,
          `Factuur ${inv.invoice_number} niet gevonden in e-Boekhouden (ID: ${inv.eboekhouden_factuur_id})`, null, check.data);
      }
    } catch {
      result.errors.push(`Factuur ${inv.invoice_number}: Fout bij verificatie`);
    }
  }

  const { data: creditNotes } = await supabase
    .from('credit_notes')
    .select('id, credit_note_number, eboekhouden_id')
    .not('eboekhouden_id', 'is', null);

  for (const cn of creditNotes || []) {
    result.creditNotesChecked++;
    try {
      const check = await ebGetInvoice(apiToken, cn.eboekhouden_id);
      if (!check.success) {
        result.creditNotesNotFound++;
        await supabase
          .from('credit_notes')
          .update({ eboekhouden_id: null, eboekhouden_synced_at: null, eboekhouden_not_found: true })
          .eq('id', cn.id);
        await logSync('credit_note', cn.id, 'verify', 'error', cn.eboekhouden_id,
          `Creditnota ${cn.credit_note_number} niet gevonden in e-Boekhouden (ID: ${cn.eboekhouden_id})`, null, check.data);
      }
    } catch {
      result.errors.push(`Creditnota ${cn.credit_note_number}: Fout bij verificatie`);
    }
  }

  const { data: purchaseInvoices } = await supabase
    .from('purchase_invoices')
    .select('id, invoice_number, eboekhouden_factuur_id')
    .not('eboekhouden_factuur_id', 'is', null);

  for (const pi of purchaseInvoices || []) {
    result.purchaseInvoicesChecked++;
    try {
      const check = await ebGetInvoice(apiToken, pi.eboekhouden_factuur_id);
      if (!check.success) {
        result.purchaseInvoicesNotFound++;
        await supabase
          .from('purchase_invoices')
          .update({ eboekhouden_factuur_id: null, eboekhouden_synced_at: null, eboekhouden_not_found: true })
          .eq('id', pi.id);
        await logSync('purchase_invoice', pi.id, 'verify', 'error', pi.eboekhouden_factuur_id,
          `Inkoopfactuur ${pi.invoice_number} niet gevonden in e-Boekhouden (ID: ${pi.eboekhouden_factuur_id})`, null, check.data);
      }
    } catch {
      result.errors.push(`Inkoopfactuur ${pi.invoice_number}: Fout bij verificatie`);
    }
  }

  return result;
}

export async function checkInvoicePaymentStatuses(
  apiToken: string
): Promise<{ updated: number; errors: string[] }> {
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, eboekhouden_factuur_id, invoice_number')
    .eq('status', 'sent')
    .not('eboekhouden_factuur_id', 'is', null);

  if (!invoices?.length) return { updated: 0, errors: [] };

  let updated = 0;
  const errors: string[] = [];

  for (const inv of invoices) {
    try {
      const result = await ebGetInvoice(apiToken, inv.eboekhouden_factuur_id);
      if (result.success) {
        const ebInvoice = result.data as Record<string, unknown>;
        const amountOpen = ebInvoice?.amountOpen ?? ebInvoice?.AmountOpen ?? ebInvoice?.openAmount ?? null;

        if (amountOpen !== null && Number(amountOpen) === 0) {
          await supabase
            .from('invoices')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', inv.id);
          updated++;
        }
      }
    } catch {
      errors.push(`Factuur ${inv.invoice_number}: Fout bij ophalen status`);
    }
  }

  return { updated, errors };
}

export async function resyncInvoiceToEBoekhouden(
  apiToken: string,
  invoiceId: string,
  settings: CompanySettings
): Promise<{ success: boolean; error?: string }> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_line_items(*),
      tenants(*),
      external_customers(*)
    `)
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice) {
    return { success: false, error: 'Factuur niet gevonden' };
  }

  await supabase
    .from('invoices')
    .update({
      eboekhouden_factuur_id: null,
      eboekhouden_synced_at: null,
    })
    .eq('id', invoiceId);

  const customer = invoice.tenants?.[0] || invoice.external_customers?.[0];
  const customerType = invoice.tenants?.[0] ? 'tenant' : 'external';

  if (!customer) {
    return { success: false, error: 'Klant niet gevonden' };
  }

  return syncInvoiceToEBoekhouden(apiToken, invoice, customer, customerType, settings);
}

export async function resyncCreditNoteToEBoekhouden(
  apiToken: string,
  creditNoteId: string,
  settings: CompanySettings
): Promise<{ success: boolean; error?: string }> {
  const { data: creditNote } = await supabase
    .from('credit_notes')
    .select(`*, credit_note_line_items(*), tenants(*), external_customers(*)`)
    .eq('id', creditNoteId)
    .maybeSingle();

  if (!creditNote) return { success: false, error: 'Creditnota niet gevonden' };

  await supabase
    .from('credit_notes')
    .update({ eboekhouden_id: null, eboekhouden_synced_at: null })
    .eq('id', creditNoteId);

  const customer = creditNote.tenants?.[0] || creditNote.external_customers?.[0];
  const customerType = creditNote.tenants?.[0] ? 'tenant' : 'external';

  if (!customer) return { success: false, error: 'Klant niet gevonden' };

  return syncCreditNoteToEBoekhouden(apiToken, creditNote, customer, customerType, settings);
}

export async function resyncPurchaseInvoiceToEBoekhouden(
  apiToken: string,
  purchaseInvoiceId: string,
  settings: CompanySettings
): Promise<{ success: boolean; error?: string }> {
  const { data: invoice } = await supabase
    .from('purchase_invoices')
    .select(`*, purchase_invoice_line_items(*)`)
    .eq('id', purchaseInvoiceId)
    .maybeSingle();

  if (!invoice) return { success: false, error: 'Inkoopfactuur niet gevonden' };

  await supabase
    .from('purchase_invoices')
    .update({ eboekhouden_factuur_id: null, eboekhouden_synced_at: null })
    .eq('id', purchaseInvoiceId);

  return syncPurchaseInvoiceToEBoekhouden(apiToken, invoice, settings);
}

export async function checkPurchaseInvoicePaymentStatuses(
  apiToken: string
): Promise<{ updated: number; errors: string[] }> {
  const { data: invoices } = await supabase
    .from('purchase_invoices')
    .select('id, eboekhouden_factuur_id, invoice_number')
    .in('status', ['pending', 'overdue'])
    .not('eboekhouden_factuur_id', 'is', null);

  if (!invoices?.length) return { updated: 0, errors: [] };

  let updated = 0;
  const errors: string[] = [];

  for (const inv of invoices) {
    try {
      const result = await ebGetMutation(apiToken, inv.eboekhouden_factuur_id);
      if (result.success) {
        const mutation = result.data as Record<string, unknown>;
        const amountOpen = mutation?.amountOpen ?? mutation?.AmountOpen ?? mutation?.openAmount ?? null;

        if (amountOpen !== null && Number(amountOpen) === 0) {
          await supabase
            .from('purchase_invoices')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', inv.id);
          updated++;
          await logSync('purchase_invoice', inv.id, 'payment_check', 'success', inv.eboekhouden_factuur_id,
            null, null, { amountOpen: 0, markedPaid: true });
        }
      }
    } catch {
      errors.push(`Inkoopfactuur ${inv.invoice_number}: Fout bij ophalen status`);
    }
  }

  return { updated, errors };
}

export async function verifyRelationsInEBoekhouden(
  apiToken: string
): Promise<{ tenantsChecked: number; tenantsNotFound: number; externalChecked: number; externalNotFound: number; errors: string[] }> {
  const result = {
    tenantsChecked: 0,
    tenantsNotFound: 0,
    externalChecked: 0,
    externalNotFound: 0,
    errors: [] as string[],
  };

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, eboekhouden_relatie_id')
    .not('eboekhouden_relatie_id', 'is', null);

  for (const tenant of tenants || []) {
    result.tenantsChecked++;
    try {
      const check = await getRelation(apiToken, tenant.eboekhouden_relatie_id);
      if (!check.success) {
        result.tenantsNotFound++;
        await supabase
          .from('tenants')
          .update({ eboekhouden_relatie_id: null })
          .eq('id', tenant.id);
        await logSync('tenant_relation', tenant.id, 'verify', 'error', tenant.eboekhouden_relatie_id,
          `Relatie voor huurder "${tenant.name}" niet gevonden in e-Boekhouden (ID: ${tenant.eboekhouden_relatie_id})`, null, check.data);
      }
    } catch {
      result.errors.push(`Huurder ${tenant.name}: Fout bij verificatie relatie`);
    }
  }

  const { data: externals } = await supabase
    .from('external_customers')
    .select('id, contact_name, company_name, eboekhouden_relatie_id')
    .not('eboekhouden_relatie_id', 'is', null);

  for (const ext of externals || []) {
    result.externalChecked++;
    const displayName = ext.company_name || ext.contact_name || ext.id;
    try {
      const check = await getRelation(apiToken, ext.eboekhouden_relatie_id);
      if (!check.success) {
        result.externalNotFound++;
        await supabase
          .from('external_customers')
          .update({ eboekhouden_relatie_id: null })
          .eq('id', ext.id);
        await logSync('external_relation', ext.id, 'verify', 'error', ext.eboekhouden_relatie_id,
          `Relatie voor externe klant "${displayName}" niet gevonden in e-Boekhouden (ID: ${ext.eboekhouden_relatie_id})`, null, check.data);
      }
    } catch {
      result.errors.push(`Externe klant ${displayName}: Fout bij verificatie relatie`);
    }
  }

  return result;
}
