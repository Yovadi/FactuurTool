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
}

interface UploadPayload {
  action: "upload" | "test";
  graph: GraphConfig;
  user_email: string;
  folder_path: string;
  file_name?: string;
  file_content_base64?: string;
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

async function ensureFolder(accessToken: string, userEmail: string, folderPath: string): Promise<void> {
  const parts = folderPath.split("/").filter(Boolean);
  let currentPath = "";

  for (const part of parts) {
    const parentPath = currentPath ? `${currentPath}:/${part}` : `root:/${part}`;
    const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/drive/${parentPath}`;

    const checkResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (checkResponse.status === 404) {
      const parentUrl = currentPath
        ? `https://graph.microsoft.com/v1.0/users/${userEmail}/drive/${currentPath}:/children`
        : `https://graph.microsoft.com/v1.0/users/${userEmail}/drive/root/children`;

      const createResponse = await fetch(parentUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: part,
          folder: {},
          "@microsoft.graph.conflictBehavior": "fail",
        }),
      });

      if (!createResponse.ok && createResponse.status !== 409) {
        const error = await createResponse.json().catch(() => ({}));
        throw new Error(`Map '${part}' aanmaken mislukt: ${error?.error?.message || createResponse.status}`);
      }
    } else if (!checkResponse.ok) {
      const error = await checkResponse.json().catch(() => ({}));
      throw new Error(`Map controleren mislukt: ${error?.error?.message || checkResponse.status}`);
    }

    currentPath = currentPath ? `${currentPath}:/${part}:` : `root:/${part}:`;
  }
}

async function uploadFile(
  accessToken: string,
  userEmail: string,
  folderPath: string,
  fileName: string,
  fileContentBase64: string
): Promise<{ webUrl: string; id: string }> {
  await ensureFolder(accessToken, userEmail, folderPath);

  const cleanPath = folderPath.replace(/^\/+|\/+$/g, "");
  const uploadUrl = `https://graph.microsoft.com/v1.0/users/${userEmail}/drive/root:/${cleanPath}/${fileName}:/content`;

  const binaryString = atob(fileContentBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/pdf",
    },
    body: bytes,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || `Upload mislukt: HTTP ${response.status}`);
  }

  const result = await response.json();
  return { webUrl: result.webUrl || "", id: result.id || "" };
}

async function testConnection(accessToken: string, userEmail: string, folderPath: string): Promise<{ success: boolean; folderUrl?: string }> {
  await ensureFolder(accessToken, userEmail, folderPath);

  const cleanPath = folderPath.replace(/^\/+|\/+$/g, "");
  const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/drive/root:/${cleanPath}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || `Map niet gevonden: HTTP ${response.status}`);
  }

  const folder = await response.json();
  return { success: true, folderUrl: folder.webUrl };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: UploadPayload = await req.json();
    const { action, graph, user_email, folder_path } = payload;

    if (!graph?.tenant_id || !graph?.client_id || !graph?.client_secret) {
      return new Response(
        JSON.stringify({ success: false, error: "Graph API configuratie onvolledig: tenant_id, client_id en client_secret zijn verplicht" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user_email) {
      return new Response(
        JSON.stringify({ success: false, error: "OneDrive gebruiker e-mail is verplicht" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(graph.tenant_id, graph.client_id, graph.client_secret);

    if (action === "test") {
      const result = await testConnection(accessToken, user_email, folder_path || "Facturen");
      return new Response(
        JSON.stringify({ success: true, folderUrl: result.folderUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "upload") {
      if (!payload.file_name || !payload.file_content_base64) {
        return new Response(
          JSON.stringify({ success: false, error: "Bestandsnaam en inhoud zijn verplicht" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await uploadFile(
        accessToken,
        user_email,
        folder_path || "Facturen",
        payload.file_name,
        payload.file_content_base64
      );

      return new Response(
        JSON.stringify({ success: true, webUrl: result.webUrl, id: result.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Onbekende actie. Gebruik 'upload' of 'test'." }),
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
