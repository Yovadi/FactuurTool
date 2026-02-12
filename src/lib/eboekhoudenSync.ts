import { supabase } from './supabase';
import type { Invoice, InvoiceLineItem, Tenant, ExternalCustomer, CompanySettings } from './supabase';
import { createRelation, createInvoice as ebCreateInvoice } from './eboekhouden';

const VAT_CODE_MAP: Record<number, string> = {
  21: 'HOOG_VERK_21',
  9: 'LAAG_VERK_9',
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
  customerType: 'tenant' | 'external'
): Promise<{ success: boolean; relationId?: number; error?: string }> {
  const isExternal = customerType === 'external';
  const table = isExternal ? 'external_customers' : 'tenants';

  const existingRelationId = customer.eboekhouden_relatie_id;
  if (existingRelationId) {
    return { success: true, relationId: existingRelationId };
  }

  const contactName = isExternal
    ? (customer as ExternalCustomer).contact_name
    : (customer as Tenant).name;

  const relationData = {
    company: customer.company_name,
    contact: contactName || '',
    email: customer.email || '',
    phone: customer.phone || '',
    address: {
      street: customer.street || '',
      postalCode: customer.postal_code || '',
      city: customer.city || '',
      country: customer.country || 'NL',
    },
  };

  const result = await createRelation(apiToken, relationData);

  if (!result.success) {
    await logSync('relation', customer.id, 'create', 'error', null, JSON.stringify(result.data), relationData, result.data);
    return { success: false, error: 'Kon relatie niet aanmaken in e-Boekhouden' };
  }

  const responseData = result.data as any;
  const relationId = responseData?.id || responseData?.Id;

  if (relationId) {
    await supabase
      .from(table)
      .update({ eboekhouden_relatie_id: relationId })
      .eq('id', customer.id);

    await logSync('relation', customer.id, 'create', 'success', relationId, null, relationData, result.data);
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
  const defaultLedgerCode = defaultMapping?.grootboek_code || '8000';

  const lineItems = invoice.line_items || [];
  const items = lineItems.map(item => ({
    description: item.description,
    quantity: item.quantity,
    pricePerUnit: item.unit_price,
    vatCode: getVatCode(invoice.vat_rate),
    ledgerId: parseInt(defaultLedgerCode, 10),
  }));

  if (items.length === 0) {
    items.push({
      description: `Factuur ${invoice.invoice_number}`,
      quantity: 1,
      pricePerUnit: invoice.subtotal,
      vatCode: getVatCode(invoice.vat_rate),
      ledgerId: parseInt(defaultLedgerCode, 10),
    });
  }

  const dueDate = new Date(invoice.due_date);
  const invoiceDate = new Date(invoice.invoice_date);
  const termDays = Math.max(0, Math.round((dueDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)));

  const invoiceData = {
    relationId: relationResult.relationId,
    date: invoice.invoice_date,
    termOfPayment: termDays,
    invoiceNumber: invoice.invoice_number,
    inExVat: invoice.vat_inclusive ? 'IN' : 'EX',
    items,
  };

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
