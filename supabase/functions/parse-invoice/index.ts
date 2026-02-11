import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParsedInvoiceData {
  invoice_number: string;
  supplier_name: string;
  supplier_address: string;
  supplier_postal_code: string;
  supplier_city: string;
  supplier_country: string;
  supplier_vat_number: string;
  supplier_kvk_number: string;
  supplier_iban: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  vat_rate: number;
  total_amount: number;
  category: string;
  line_items: {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    vat_rate: number;
  }[];
}

const systemPrompt = `Je bent een expert in het herkennen en extraheren van gegevens uit Nederlandse facturen.
Analyseer de factuur en extraheer ALLE gegevens in het volgende JSON-formaat.
Geef ALLEEN geldige JSON terug, geen andere tekst.

{
  "invoice_number": "factuurnummer",
  "supplier_name": "naam leverancier/bedrijf",
  "supplier_address": "straat + huisnummer",
  "supplier_postal_code": "postcode",
  "supplier_city": "plaats",
  "supplier_country": "land (standaard Nederland)",
  "supplier_vat_number": "BTW-nummer",
  "supplier_kvk_number": "KVK-nummer",
  "supplier_iban": "IBAN bankrekeningnummer",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD (of lege string als niet vermeld)",
  "subtotal": 0.00,
  "vat_amount": 0.00,
  "vat_rate": 21,
  "total_amount": 0.00,
  "category": "categorie (bijv. onderhoud, kantoorbenodigdheden, energie, verzekering, telecom, schoonmaak, overig)",
  "line_items": [
    {
      "description": "omschrijving",
      "quantity": 1,
      "unit_price": 0.00,
      "amount": 0.00,
      "vat_rate": 21
    }
  ]
}

Regels:
- Alle bedragen als getallen (geen valutasymbolen)
- Datums in YYYY-MM-DD formaat
- Als je iets niet kunt vinden, gebruik een lege string of 0
- Als er geen regelitems zijn, maak er een aan met de totaalbeschrijving
- BTW-tarief is meestal 21% in Nederland, maar controleer dit
- Probeer de categorie te bepalen op basis van de inhoud`;

function buildContentParts(fileBase64: string, fileType: string) {
  const textPart = {
    type: "text" as const,
    text: "Analyseer deze factuur en extraheer alle gegevens. Geef ALLEEN geldige JSON terug.",
  };

  if (fileType === "application/pdf") {
    return [
      textPart,
      {
        type: "file" as const,
        file: {
          filename: "invoice.pdf",
          file_data: `data:application/pdf;base64,${fileBase64}`,
        },
      },
    ];
  }

  const mediaType = fileType || "image/png";
  return [
    textPart,
    {
      type: "image_url" as const,
      image_url: {
        url: `data:${mediaType};base64,${fileBase64}`,
        detail: "high" as const,
      },
    },
  ];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { file_base64, file_type, openai_api_key } = await req.json();

    if (!file_base64 || !openai_api_key) {
      return new Response(
        JSON.stringify({
          error: "file_base64 and openai_api_key are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contentParts = buildContentParts(file_base64, file_type);

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentParts },
    ];

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openai_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          max_tokens: 2000,
          temperature: 0.1,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      return new Response(
        JSON.stringify({
          error: `OpenAI API fout (${openaiResponse.status}): Controleer of uw API key geldig is en voldoende saldo heeft.`,
          details: errorData,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content || "";

    let parsed: ParsedInvoiceData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Kon het AI-antwoord niet verwerken. Probeer het opnieuw.",
          raw_response: content,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: parsed,
        confidence: 85,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Er is een interne fout opgetreden.",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
