import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EB_API_BASE = "https://api.e-boekhouden.nl";

interface SessionResponse {
  token: string;
}

async function createSession(apiToken: string): Promise<string> {
  const cleanToken = apiToken.trim();
  const res = await fetch(`${EB_API_BASE}/v1/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "HAL5Fact",
      accessToken: cleanToken,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `e-Boekhouden sessie aanmaken mislukt (${res.status}): ${errorText}`
    );
  }

  const data: SessionResponse = await res.json();
  return data.token;
}

async function proxyRequest(
  sessionToken: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const url = `${EB_API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${sessionToken}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = { method, headers };
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";

  let data: unknown;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { api_token, action, params } = await req.json();

    if (!api_token) {
      return new Response(
        JSON.stringify({ error: "api_token is verplicht" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!action) {
      return new Response(
        JSON.stringify({ error: "action is verplicht" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sessionToken = await createSession(api_token);

    let result: { status: number; data: unknown };

    switch (action) {
      case "test_connection":
        result = await proxyRequest(sessionToken, "GET", "/v1/administration");
        break;

      case "get_relations":
        result = await proxyRequest(
          sessionToken,
          "GET",
          `/v1/relation?limit=${params?.limit || 100}&offset=${params?.offset || 0}`
        );
        break;

      case "get_relation":
        result = await proxyRequest(
          sessionToken,
          "GET",
          `/v1/relation/${params.id}`
        );
        break;

      case "create_relation":
        result = await proxyRequest(
          sessionToken,
          "POST",
          "/v1/relation",
          params.data
        );
        break;

      case "update_relation":
        result = await proxyRequest(
          sessionToken,
          "PATCH",
          `/v1/relation/${params.id}`,
          params.data
        );
        break;

      case "get_ledger_accounts":
        result = await proxyRequest(
          sessionToken,
          "GET",
          `/v1/ledger?limit=${params?.limit || 500}&offset=${params?.offset || 0}`
        );
        break;

      case "create_invoice":
        result = await proxyRequest(
          sessionToken,
          "POST",
          "/v1/invoice",
          params.data
        );
        break;

      case "get_invoices":
        result = await proxyRequest(
          sessionToken,
          "GET",
          `/v1/invoice?limit=${params?.limit || 100}&offset=${params?.offset || 0}`
        );
        break;

      case "get_invoice":
        result = await proxyRequest(
          sessionToken,
          "GET",
          `/v1/invoice/${params.id}`
        );
        break;

      case "create_mutation":
        result = await proxyRequest(
          sessionToken,
          "POST",
          "/v1/mutation",
          params.data
        );
        break;

      case "get_cost_centers":
        result = await proxyRequest(
          sessionToken,
          "GET",
          `/v1/costcenter?limit=${params?.limit || 100}&offset=${params?.offset || 0}`
        );
        break;

      case "get_email_templates":
        result = await proxyRequest(
          sessionToken,
          "GET",
          "/v1/emailtemplate"
        );
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Onbekende actie: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(
      JSON.stringify({
        success: result.status >= 200 && result.status < 300,
        status: result.status,
        data: result.data,
      }),
      {
        status: result.status >= 200 && result.status < 300 ? 200 : result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Onbekende fout opgetreden",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
