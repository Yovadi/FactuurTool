import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ResendConfig {
  api_key: string;
  from_email: string;
  from_name?: string;
}

interface SendEmailPayload {
  action: "send" | "test";
  resend: ResendConfig;
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: SendEmailPayload = await req.json();
    const { action, resend, to } = payload;

    if (!resend?.api_key || !resend?.from_email) {
      return new Response(
        JSON.stringify({ success: false, error: "Resend configuratie onvolledig: api_key en from_email zijn verplicht" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromAddress = resend.from_name
      ? `${resend.from_name} <${resend.from_email}>`
      : resend.from_email;

    if (action === "test") {
      const body: Record<string, unknown> = {
        from: fromAddress,
        to: [to || resend.from_email],
        subject: "HAL5 Factuurmanager - Resend Test",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a2e;">Resend Verbinding Succesvol</h2>
            <p>Deze test-e-mail bevestigt dat de Resend koppeling correct is geconfigureerd.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">Verzonden via HAL5 Factuurmanager</p>
          </div>
        `,
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resend.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ success: false, error: result.message || result.name || "Resend API fout" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, id: result.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send") {
      if (!payload.subject) {
        return new Response(
          JSON.stringify({ success: false, error: "Onderwerp is verplicht voor het verzenden van e-mails" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body: Record<string, unknown> = {
        from: fromAddress,
        to: [to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      };

      if (payload.attachments && payload.attachments.length > 0) {
        body.attachments = payload.attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          content_type: att.contentType || "application/pdf",
        }));
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resend.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ success: false, error: result.message || result.name || "Resend API fout" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, id: result.id }),
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
