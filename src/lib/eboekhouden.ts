const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL || 'https://qlvndvpxhqmjljjpehkn.supabase.co'}/functions/v1/eboekhouden-proxy`;

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdm5kdnB4aHFtamxqanBlaGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5MjI1MzQsImV4cCI6MjA3NjQ5ODUzNH0.q1Kel_GCQqUx2J5Nd9WFOVz7okodFPcoAJkKL6YVkUk';

interface EBoekhoudenResponse<T = unknown> {
  success: boolean;
  status: number;
  data: T;
  error?: string;
}

async function callProxy<T = unknown>(
  apiToken: string,
  action: string,
  params?: Record<string, unknown>
): Promise<EBoekhoudenResponse<T>> {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      api_token: apiToken,
      action,
      params,
    }),
  });

  return res.json();
}

export async function testConnection(apiToken: string) {
  return callProxy(apiToken, 'test_connection');
}

export async function getRelations(apiToken: string, limit = 100, offset = 0) {
  return callProxy(apiToken, 'get_relations', { limit, offset });
}

export async function getRelation(apiToken: string, id: number) {
  return callProxy(apiToken, 'get_relation', { id });
}

export async function createRelation(apiToken: string, data: Record<string, unknown>) {
  return callProxy(apiToken, 'create_relation', { data });
}

export async function updateRelation(apiToken: string, id: number, data: Record<string, unknown>) {
  return callProxy(apiToken, 'update_relation', { id, data });
}

export async function getLedgerAccounts(apiToken: string, limit = 500, offset = 0) {
  return callProxy(apiToken, 'get_ledger_accounts', { limit, offset });
}

export async function createInvoice(apiToken: string, data: Record<string, unknown>) {
  return callProxy(apiToken, 'create_invoice', { data });
}

export async function getInvoices(apiToken: string, limit = 100, offset = 0) {
  return callProxy(apiToken, 'get_invoices', { limit, offset });
}

export async function createMutation(apiToken: string, data: Record<string, unknown>) {
  return callProxy(apiToken, 'create_mutation', { data });
}

export async function getInvoiceTemplates(apiToken: string) {
  return callProxy(apiToken, 'get_invoice_templates');
}

export async function getEmailTemplates(apiToken: string) {
  return callProxy(apiToken, 'get_email_templates');
}

export async function diagnoseConnection(apiToken: string) {
  return callProxy(apiToken, 'diagnose');
}
