import { supabase } from './supabase';
import type { Invoice, InvoiceLineItem, Tenant, ExternalCustomer, CompanySettings, PurchaseInvoice, PurchaseInvoiceLineItem } from './supabase';
import { createRelation, getRelation, updateRelation, createInvoice as ebCreateInvoice, createMutation } from './eboekhouden';

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
  const items = lineItems.map(item => ({
    description: item.description,
    quantity: item.quantity,
    pricePerUnit: item.unit_price,
    vatCode: getVatCode(invoice.vat_rate),
    ledgerId: defaultLedgerId,
  }));

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

  const categoryMapping = mappings?.find(m => m.local_category === `inkoop_${invoice.category}`);
  const defaultMapping = mappings?.find(m => m.local_category === 'inkoop_default') || mappings?.find(m => m.local_category === 'default');
  const ledgerId = categoryMapping?.grootboek_id || defaultMapping?.grootboek_id;

  if (!ledgerId) {
    return { success: false, error: 'Geen grootboekrekening geconfigureerd. Stel een "Inkoop - Standaard" of "Standaard" mapping in bij e-Boekhouden instellingen.' };
  }

  const lineItems = invoice.purchase_invoice_line_items || [];
  const items = lineItems.map(item => ({
    description: item.description,
    quantity: item.quantity,
    pricePerUnit: item.unit_price,
    vatCode: getPurchaseVatCode(item.vat_rate || invoice.vat_rate),
    ledgerId,
  }));

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
