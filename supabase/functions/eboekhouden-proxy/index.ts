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

async function createSession(
  apiToken: string
): Promise<{ token: string; raw?: unknown }> {
  const cleanToken = apiToken.trim().replace(/[\r\n\t]/g, "");

  const requestBody = {
    accessToken: cleanToken,
    source: "HAL5Fact",
  };

  const res = await fetch(`${EB_API_BASE}/v1/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const contentType = res.headers.get("content-type") || "";
  let responseBody: unknown;

  if (contentType.includes("application/json")) {
    responseBody = await res.json();
  } else {
    responseBody = await res.text();
  }

  if (!res.ok) {
    const errorObj = responseBody as Record<string, unknown>;
    const title = errorObj?.title || "";
    const code = errorObj?.code || "";

    let errorDetail: string;

    if (title === "Login failed") {
      errorDetail =
        "Login mislukt bij e-Boekhouden. Het API token wordt niet geaccepteerd.";
    } else if (code === "API_SESSION_004") {
      errorDetail =
        "Het API token is verlopen. Maak een nieuw token aan in e-Boekhouden.";
    } else if (errorObj?.type === "validation") {
      const messages = errorObj?.errors
        ? Object.values(errorObj.errors as Record<string, string[]>)
            .flat()
            .join(", ")
        : title || "Validatiefout";
      errorDetail = `Validatiefout: ${messages}`;
    } else {
      errorDetail =
        (title as string) ||
        (errorObj?.message as string) ||
        JSON.stringify(responseBody);
    }

    const err = new Error(errorDetail);
    (err as Error & { rawResponse: unknown }).rawResponse = responseBody;
    (err as Error & { httpStatus: number }).httpStatus = res.status;
    throw err;
  }

  const data = responseBody as SessionResponse;
  return { token: data.token };
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

async function runDiagnostics(apiToken: string) {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tokenLength: apiToken?.length || 0,
    tokenPrefix: apiToken ? apiToken.substring(0, 4) + "..." : "empty",
    tokenSuffix: apiToken ? "..." + apiToken.substring(apiToken.length - 4) : "empty",
  };

  try {
    const healthCheck = await fetch(`${EB_API_BASE}/swagger/v1/swagger.json`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    diagnostics.apiReachable = true;
    diagnostics.apiStatus = healthCheck.status;
  } catch (e) {
    diagnostics.apiReachable = false;
    diagnostics.apiError = e instanceof Error ? e.message : String(e);
  }

  const cleanToken = apiToken.trim().replace(/[\r\n\t]/g, "");
  const requestBody = { accessToken: cleanToken, source: "HAL5Fact" };

  try {
    const sessionRes = await fetch(`${EB_API_BASE}/v1/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const ct = sessionRes.headers.get("content-type") || "";
    let sessionBody: unknown;
    if (ct.includes("application/json")) {
      sessionBody = await sessionRes.json();
    } else {
      sessionBody = await sessionRes.text();
    }

    diagnostics.sessionHttpStatus = sessionRes.status;
    diagnostics.sessionSuccess = sessionRes.ok;
    diagnostics.sessionResponse = sessionBody;
    diagnostics.requestBodySent = {
      accessToken: cleanToken.substring(0, 4) + "***" + cleanToken.substring(cleanToken.length - 4),
      source: "HAL5Fact",
    };
  } catch (e) {
    diagnostics.sessionError = e instanceof Error ? e.message : String(e);
  }

  return diagnostics;
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

    if (action === "diagnose") {
      const diagnostics = await runDiagnostics(api_token);
      return new Response(
        JSON.stringify({ success: diagnostics.sessionSuccess === true, diagnostics }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "test_connection") {
      const session = await createSession(api_token);
      return new Response(
        JSON.stringify({
          success: true,
          status: 200,
          data: { message: "Sessie succesvol aangemaakt", tokenReceived: !!session.token },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const session = await createSession(api_token);

    let result: { status: number; data: unknown };

    switch (action) {

      case "get_relations":
        result = await proxyRequest(
          session.token,
          "GET",
          `/v1/relation?limit=${params?.limit || 100}&offset=${params?.offset || 0}`
        );
        break;

      case "get_relation":
        result = await proxyRequest(
          session.token,
          "GET",
          `/v1/relation/${params.id}`
        );
        break;

      case "create_relation":
        result = await proxyRequest(
          session.token,
          "POST",
          "/v1/relation",
          params.data
        );
        break;

      case "update_relation":
        result = await proxyRequest(
          session.token,
          "PATCH",
          `/v1/relation/${params.id}`,
          params.data
        );
        break;

      case "get_ledger_accounts":
        result = await proxyRequest(
          session.token,
          "GET",
          `/v1/ledger?limit=${params?.limit || 500}&offset=${params?.offset || 0}`
        );
        break;

      case "create_invoice":
        result = await proxyRequest(
          session.token,
          "POST",
          "/v1/invoice",
          params.data
        );
        break;

      case "get_invoices":
        result = await proxyRequest(
          session.token,
          "GET",
          `/v1/invoice?limit=${params?.limit || 100}&offset=${params?.offset || 0}`
        );
        break;

      case "get_invoice":
        result = await proxyRequest(
          session.token,
          "GET",
          `/v1/invoice/${params.id}`
        );
        break;

      case "create_mutation":
        result = await proxyRequest(
          session.token,
          "POST",
          "/v1/mutation",
          params.data
        );
        break;

      case "get_cost_centers":
        result = await proxyRequest(
          session.token,
          "GET",
          `/v1/costcenter?limit=${params?.limit || 100}&offset=${params?.offset || 0}`
        );
        break;

      case "get_email_templates":
        result = await proxyRequest(
          session.token,
          "GET",
          "/v1/emailtemplate"
        );
        break;

      case "get_invoice_templates":
        result = await proxyRequest(
          session.token,
          "GET",
          `/v1/invoicetemplate?limit=${params?.limit || 100}&offset=${params?.offset || 0}`
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
    const errObj: Record<string, unknown> = {
      success: false,
      error:
        error instanceof Error ? error.message : "Onbekende fout opgetreden",
    };

    if (error && typeof error === "object" && "rawResponse" in error) {
      errObj.rawApiResponse = (error as { rawResponse: unknown }).rawResponse;
    }
    if (error && typeof error === "object" && "httpStatus" in error) {
      errObj.apiHttpStatus = (error as { httpStatus: number }).httpStatus;
    }

    return new Response(JSON.stringify(errObj), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
