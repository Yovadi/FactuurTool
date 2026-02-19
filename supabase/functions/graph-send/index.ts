import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GraphConfig {
  tenant_id: string;
  client_id: string;
  client_secret: string;
  from_email: string;
  from_name?: string;
}

interface Attachment {
  filename: string;
  content: string;
  encoding: string;
  contentType: string;
}

interface SendEmailPayload {
  action: "send" | "test";
  graph: GraphConfig;
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: Attachment[];
}

async function getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || "Token ophalen mislukt");
  }

  const data = await response.json();
  return data.access_token;
}

async function sendMail(
  accessToken: string,
  fromEmail: string,
  fromName: string | undefined,
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments?: Attachment[]
): Promise<void> {
  const mailBody: Record<string, unknown> = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: html || `<p>${text}</p>`,
      },
      toRecipients: [
        {
          emailAddress: { address: to },
        },
      ],
      from: {
        emailAddress: {
          address: fromEmail,
          ...(fromName ? { name: fromName } : {}),
        },
      },
    },
    saveToSentItems: false,
  };

  if (attachments && attachments.length > 0) {
    (mailBody.message as Record<string, unknown>).attachments = attachments.map((att) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.filename,
      contentType: att.contentType || "application/pdf",
      contentBytes: att.content,
    }));
  }

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mailBody),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error?.error?.message || error?.error?.code || `HTTP ${response.status}`;
    throw new Error(msg);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: SendEmailPayload = await req.json();
    const { action, graph } = payload;

    if (!graph?.tenant_id || !graph?.client_id || !graph?.client_secret || !graph?.from_email) {
      return new Response(
        JSON.stringify({ success: false, error: "Graph API configuratie onvolledig: tenant_id, client_id, client_secret en from_email zijn verplicht" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(graph.tenant_id, graph.client_id, graph.client_secret);

    if (action === "test") {
      await sendMail(
        accessToken,
        graph.from_email,
        graph.from_name,
        payload.to || graph.from_email,
        "HAL5 Factuurmanager - Microsoft Graph API Test",
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a2e;">Graph API Verbinding Succesvol</h2>
          <p>Deze test-e-mail bevestigt dat de Microsoft Graph API koppeling correct is geconfigureerd.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Verzonden via HAL5 Factuurmanager</p>
        </div>`,
        "Graph API verbinding succesvol. Deze test-e-mail bevestigt dat de koppeling correct is geconfigureerd."
      );

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send") {
      if (!payload.subject || !payload.to) {
        return new Response(
          JSON.stringify({ success: false, error: "Onderwerp en ontvanger zijn verplicht" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await sendMail(
        accessToken,
        graph.from_email,
        graph.from_name,
        payload.to,
        payload.subject,
        payload.html || "",
        payload.text || "",
        payload.attachments
      );

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Onbekende actie. Gebruik 'send' of 'test'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
