import { supabase, type CompanySettings } from '../lib/supabase';

export type EmailMethod = 'smtp' | 'graph' | 'resend' | 'outlook';

export type EmailLog = {
  id: string;
  to_email: string;
  to_name: string;
  subject: string;
  body: string;
  method: EmailMethod;
  status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
  invoice_id: string | null;
  credit_note_id: string | null;
  attachment_name: string;
  sent_at: string;
  created_at: string;
};

type SendEmailParams = {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  html?: string;
  attachmentBase64?: string;
  attachmentName?: string;
  invoiceId?: string;
  creditNoteId?: string;
};

function parseDataUrl(dataUrl: string): { contentType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], base64: match[2] };
}

function getSignatureAttachment(settings: CompanySettings): { filename: string; content: string; encoding: string; contentType: string; cid: string } | null {
  if (!settings.email_signature_image) return null;
  const parsed = parseDataUrl(settings.email_signature_image);
  if (!parsed) return null;
  const ext = parsed.contentType.split('/')[1] || 'png';
  return {
    filename: `signature.${ext}`,
    content: parsed.base64,
    encoding: 'base64',
    contentType: parsed.contentType,
    cid: 'signature-image',
  };
}

function getActiveMethod(settings: CompanySettings): EmailMethod | null {
  if (settings.smtp_enabled && settings.smtp_connected) return 'smtp';
  if (settings.graph_enabled && settings.graph_connected) return 'graph';
  if (settings.resend_enabled && settings.resend_connected) return 'resend';
  return null;
}

export function getActiveEmailMethodLabel(settings: CompanySettings | null): string | null {
  if (!settings) return null;
  const method = getActiveMethod(settings);
  if (!method) return null;
  const labels: Record<EmailMethod, string> = {
    smtp: 'SMTP',
    graph: 'Microsoft Graph',
    resend: 'Resend',
    outlook: 'Outlook',
  };
  return labels[method];
}

export function isEmailConfigured(settings: CompanySettings | null): boolean {
  if (!settings) return false;
  return getActiveMethod(settings) !== null;
}

export async function sendEmail(
  settings: CompanySettings,
  params: SendEmailParams
): Promise<{ success: boolean; error?: string }> {
  const method = getActiveMethod(settings);
  if (!method) {
    return { success: false, error: 'Geen e-mail methode geconfigureerd' };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const logEntry = {
    to_email: params.to,
    to_name: params.toName || '',
    subject: params.subject,
    body: params.body,
    method,
    status: 'pending' as const,
    invoice_id: params.invoiceId || null,
    credit_note_id: params.creditNoteId || null,
    attachment_name: params.attachmentName || '',
  };

  const { data: logRow } = await supabase
    .from('email_logs')
    .insert(logEntry)
    .select('id')
    .maybeSingle();

  try {
    let result: { success: boolean; error?: string };

    if (method === 'smtp') {
      result = await sendViaSMTP(supabaseUrl, supabaseAnonKey, settings, params);
    } else if (method === 'graph') {
      result = await sendViaGraph(supabaseUrl, supabaseAnonKey, settings, params);
    } else if (method === 'resend') {
      result = await sendViaResend(supabaseUrl, supabaseAnonKey, settings, params);
    } else {
      result = { success: false, error: 'Onbekende methode' };
    }

    if (logRow?.id) {
      await supabase
        .from('email_logs')
        .update({
          status: result.success ? 'sent' : 'failed',
          error_message: result.error || null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', logRow.id);
    }

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Onbekende fout';
    if (logRow?.id) {
      await supabase
        .from('email_logs')
        .update({ status: 'failed', error_message: errorMsg })
        .eq('id', logRow.id);
    }
    return { success: false, error: errorMsg };
  }
}

async function sendViaSMTP(
  supabaseUrl: string,
  supabaseAnonKey: string,
  settings: CompanySettings,
  params: SendEmailParams
): Promise<{ success: boolean; error?: string }> {
  const body: Record<string, unknown> = {
    action: 'send',
    smtp: {
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      user: settings.smtp_user,
      password: settings.smtp_password,
      from_name: settings.smtp_from_name || settings.smtp_user,
      from_email: settings.smtp_from_email || settings.smtp_user,
    },
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: params.html,
  };

  const attachments: any[] = [];
  if (params.attachmentBase64 && params.attachmentName) {
    attachments.push({
      filename: params.attachmentName,
      content: params.attachmentBase64,
      encoding: 'base64',
    });
  }
  const sigAttachment = getSignatureAttachment(settings);
  if (sigAttachment && params.html) {
    attachments.push(sigAttachment);
  }
  if (attachments.length > 0) {
    body.attachments = attachments;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/smtp-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });

  return await response.json();
}

async function sendViaGraph(
  supabaseUrl: string,
  supabaseAnonKey: string,
  settings: CompanySettings,
  params: SendEmailParams
): Promise<{ success: boolean; error?: string }> {
  const body: Record<string, unknown> = {
    action: 'send',
    graph: {
      tenant_id: settings.graph_tenant_id,
      client_id: settings.graph_client_id,
      client_secret: settings.graph_client_secret,
      from_email: settings.graph_from_email,
      from_name: settings.graph_from_name,
    },
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: params.html,
  };

  const attachments: any[] = [];
  if (params.attachmentBase64 && params.attachmentName) {
    attachments.push({
      filename: params.attachmentName,
      content: params.attachmentBase64,
      encoding: 'base64',
    });
  }
  const sigAttachment = getSignatureAttachment(settings);
  if (sigAttachment && params.html) {
    attachments.push(sigAttachment);
  }
  if (attachments.length > 0) {
    body.attachments = attachments;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/graph-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });

  return await response.json();
}

async function sendViaResend(
  supabaseUrl: string,
  supabaseAnonKey: string,
  settings: CompanySettings,
  params: SendEmailParams
): Promise<{ success: boolean; error?: string }> {
  const body: Record<string, unknown> = {
    action: 'send',
    resend: {
      api_key: settings.resend_api_key,
      from_email: settings.resend_from_email,
      from_name: settings.resend_from_name,
    },
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: params.html,
  };

  const attachments: any[] = [];
  if (params.attachmentBase64 && params.attachmentName) {
    attachments.push({
      filename: params.attachmentName,
      content: params.attachmentBase64,
      encoding: 'base64',
    });
  }
  const sigAttachment = getSignatureAttachment(settings);
  if (sigAttachment && params.html) {
    attachments.push(sigAttachment);
  }
  if (attachments.length > 0) {
    body.attachments = attachments;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/resend-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });

  return await response.json();
}

export async function loadEmailLogs(limit = 50): Promise<EmailLog[]> {
  const { data } = await supabase
    .from('email_logs')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(limit);

  return (data || []) as EmailLog[];
}
