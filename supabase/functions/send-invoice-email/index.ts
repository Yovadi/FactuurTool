import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  subject: string;
  invoiceNumber: string;
  tenantName: string;
  companyName: string;
  amount: number;
  dueDate: string;
  invoiceDate: string;
  pdfBase64?: string;
  companyEmail?: string;
  companyPhone?: string;
  logoBase64?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from("company_settings")
      .select("resend_api_key")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const resendApiKey = settings?.resend_api_key;

    if (!resendApiKey) {
      throw new Error("Resend API key niet geconfigureerd in bedrijfsinstellingen");
    }

    const requestData: EmailRequest = await req.json();
    const {
      to,
      subject,
      invoiceNumber,
      tenantName,
      companyName,
      amount,
      dueDate,
      invoiceDate,
      pdfBase64,
      companyEmail,
      companyPhone,
      logoBase64,
    } = requestData;

    const formattedAmount = new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);

    const formattedDueDate = new Date(dueDate).toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedInvoiceDate = new Date(invoiceDate).toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const contactInfo = [];
    if (companyEmail) contactInfo.push(`Email: ${companyEmail}`);
    if (companyPhone) contactInfo.push(`Telefoon: ${companyPhone}`);
    const contactString = contactInfo.length > 0 ? contactInfo.join(' | ') : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="nl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Factuur ${invoiceNumber}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${companyName}</h1>
        </div>
        
        <div style="background-color: #ffffff; padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b; margin-top: 0; margin-bottom: 20px;">Beste ${tenantName},</h2>
          
          <p style="margin-bottom: 20px;">Hierbij ontvangt u factuur <strong>${invoiceNumber}</strong> van ${companyName}.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 4px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Factuurnummer:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Factuurdatum:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formattedInvoiceDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Vervaldatum:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">${formattedDueDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; border-top: 2px solid #cbd5e1; padding-top: 15px;">Totaalbedrag:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 20px; color: #667eea; border-top: 2px solid #cbd5e1; padding-top: 15px;">${formattedAmount}</td>
              </tr>
            </table>
          </div>
          
          <p style="margin-bottom: 20px;">De factuur is als PDF bijgevoegd aan deze email. Wij verzoeken u vriendelijk het verschuldigde bedrag voor de vervaldatum over te maken naar de op de factuur vermelde rekening.</p>
          
          <p style="margin-bottom: 30px;">Heeft u vragen over deze factuur? Neem dan gerust contact met ons op.</p>
          
          <div style="border-top: 2px solid #e2e8f0; padding-top: 20px; margin-top: 40px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="vertical-align: top; padding-right: 20px;">
                  <p style="color: #64748b; margin: 5px 0 10px 0;">Met vriendelijke groet,</p>
                  <p style="font-weight: 600; color: #1e293b; margin: 5px 0;">${companyName}</p>
                  ${contactString ? `<p style="color: #64748b; font-size: 14px; margin: 10px 0 0 0;">${contactString}</p>` : ''}
                </td>
                <td style="text-align: right; vertical-align: bottom;">
                  ${logoBase64 ? `<img src="cid:company-logo" alt="${companyName}" style="width: 120px; height: auto;" />` : ''}
                </td>
              </tr>
            </table>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
          <p>Deze email is automatisch gegenereerd. Gelieve hier niet op te antwoorden.</p>
        </div>
      </body>
      </html>
    `;

    const emailPayload: any = {
      from: "onboarding@resend.dev",
      reply_to: companyEmail,
      to: [to],
      subject: subject,
      html: htmlContent,
    };

    const attachments: any[] = [];

    if (pdfBase64) {
      attachments.push({
        filename: `${invoiceNumber}.pdf`,
        content: pdfBase64,
      });
    }

    if (logoBase64) {
      attachments.push({
        filename: "logo.png",
        content: logoBase64,
        content_id: "company-logo",
      });
    }

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(`Email verzenden mislukt: ${JSON.stringify(errorData)}`);
    }

    const responseData = await resendResponse.json();

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Onbekende fout" 
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});