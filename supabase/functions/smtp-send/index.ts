import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SmtpClient } from "npm:nodemailer@6.9.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from_name: string;
  from_email: string;
}

interface SendEmailPayload {
  action: "send" | "test";
  smtp: SmtpConfig;
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    encoding: string;
    contentType: string;
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: SendEmailPayload = await req.json();
    const { action, smtp, to } = payload;

    if (!smtp?.host || !smtp?.user || !smtp?.password) {
      return new Response(
        JSON.stringify({ success: false, error: "SMTP configuratie onvolledig: host, user en password zijn verplicht" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nodemailer = await import("npm:nodemailer@6.9.9");

    const transporter = nodemailer.default.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: (smtp.port || 587) === 465,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
      tls: {
        ciphers: "SSLv3",
        rejectUnauthorized: false,
      },
    });

    const fromAddress = smtp.from_email || smtp.user;
    const fromDisplay = smtp.from_name ? `"${smtp.from_name}" <${fromAddress}>` : fromAddress;

    if (action === "test") {
      const info = await transporter.sendMail({
        from: fromDisplay,
        to: to || smtp.user,
        subject: "HAL5 Factuurmanager - SMTP Test",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a2e;">SMTP Verbinding Succesvol</h2>
            <p>Deze test-e-mail bevestigt dat de SMTP koppeling correct is geconfigureerd.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">Verzonden via HAL5 Factuurmanager</p>
          </div>
        `,
        text: "SMTP verbinding succesvol. Deze test-e-mail bevestigt dat de SMTP koppeling correct is geconfigureerd.",
      });

      return new Response(
        JSON.stringify({ success: true, messageId: info.messageId }),
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

      const mailOptions: Record<string, unknown> = {
        from: fromDisplay,
        to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      };

      if (payload.attachments && payload.attachments.length > 0) {
        mailOptions.attachments = payload.attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          encoding: att.encoding || "base64",
          contentType: att.contentType || "application/pdf",
        }));
      }

      const info = await transporter.sendMail(mailOptions);

      return new Response(
        JSON.stringify({ success: true, messageId: info.messageId }),
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
