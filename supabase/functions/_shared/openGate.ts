import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { bookerProfile, pinAttemptBlocked, type GateProfile } from "../../../src/utils/accessGate.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STAFF_EMAIL = "staff@hal5.internal";

type GateResult = {
  status: number;
  body: {
    error?: string;
    access_token?: string;
    refresh_token?: string;
    profile?: GateProfile;
  };
};

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("missing service role");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function signInClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anon) throw new Error("missing service role");
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function pinHash(scope: string, pin: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${scope}:${pin}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function failures(admin: SupabaseClient, hash: string): Promise<number> {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("pin_attempts")
    .select("id", { count: "exact", head: true })
    .eq("pin_hash", hash)
    .gte("created_at", since);
  if (error) return 0;
  return count || 0;
}

async function noteFailure(admin: SupabaseClient, hash: string) {
  await admin.from("pin_attempts").insert({ pin_hash: hash });
}

async function clearFailures(admin: SupabaseClient, hash: string) {
  await admin.from("pin_attempts").delete().eq("pin_hash", hash);
}

async function findUserId(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((user) => user.email === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function signIn(email: string, password: string) {
  const signed = await signInClient().auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw signed.error || new Error("geen sessie");
  return signed.data.session;
}

async function markReady(admin: SupabaseClient, column: "staff_gate_ready" | "booking_gate_ready") {
  const { data } = await admin.from("company_settings").select("id").limit(1).maybeSingle();
  if (!data?.id) return;
  await admin.from("company_settings").update({ [column]: true }).eq("id", data.id);
}

async function ensureStaffSession(admin: SupabaseClient) {
  const { data: existing } = await admin
    .from("access_gate_secrets")
    .select("staff_password, auth_user_id")
    .eq("id", 1)
    .maybeSingle();
  let password = existing?.staff_password as string | undefined;
  let userId = existing?.auth_user_id as string | undefined;
  if (!password) {
    password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { error } = await admin.from("access_gate_secrets").insert({ id: 1, staff_password: password });
    if (error) throw error;
  }
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email: STAFF_EMAIL,
      password,
      email_confirm: true,
      app_metadata: { app_role: "staff" },
    });
    userId = created.data.user?.id;
    if (!userId) userId = await findUserId(admin, STAFF_EMAIL) || undefined;
    if (!userId) throw created.error || new Error("medewerker niet aangemaakt");
    if (created.error) {
      await admin.auth.admin.updateUserById(userId, { password, app_metadata: { app_role: "staff" } });
    }
    await admin.from("access_gate_secrets").update({ auth_user_id: userId }).eq("id", 1);
  }
  return signIn(STAFF_EMAIL, password);
}

async function ensureBookerSession(admin: SupabaseClient, customerId: string, customerType: "tenant" | "external") {
  const email = `booker-${customerId}@hal5.internal`;
  const { data: existing } = await admin
    .from("booker_credentials")
    .select("password, auth_user_id")
    .eq("customer_id", customerId)
    .maybeSingle();
  let password = existing?.password as string | undefined;
  let userId = existing?.auth_user_id as string | undefined;
  const metadata = { app_role: "booker", customer_id: customerId, customer_type: customerType };
  if (!password) {
    password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  }
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: metadata,
    });
    userId = created.data.user?.id;
    if (!userId) userId = await findUserId(admin, email) || undefined;
    if (!userId) throw created.error || new Error("boeking niet aangemaakt");
    if (created.error) {
      await admin.auth.admin.updateUserById(userId, { password, app_metadata: metadata });
    }
    if (existing) {
      await admin.from("booker_credentials").update({ password, auth_user_id: userId, email }).eq("customer_id", customerId);
    } else {
      const { error } = await admin.from("booker_credentials").insert({
        customer_id: customerId,
        customer_type: customerType,
        email,
        password,
        auth_user_id: userId,
      });
      if (error) throw error;
    }
  }
  return signIn(email, password);
}

export async function openStaffSession(pin: string): Promise<GateResult> {
  const admin = adminClient();
  if (!/^\d{4,8}$/.test(pin)) return { status: 401, body: { error: "Onjuiste personeels-PIN" } };
  const hash = await pinHash("staff", pin);
  if (pinAttemptBlocked(await failures(admin, hash))) {
    return { status: 429, body: { error: "Te veel pogingen. Wacht een kwartier." } };
  }
  const { data: settings } = await admin
    .from("company_settings")
    .select("staff_pin_code")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const expected = String(settings?.staff_pin_code || "").trim();
  if (!expected || expected !== pin) {
    await noteFailure(admin, hash);
    return { status: 401, body: { error: "Onjuiste personeels-PIN" } };
  }
  const session = await ensureStaffSession(admin);
  await clearFailures(admin, hash);
  await markReady(admin, "staff_gate_ready");
  return {
    status: 200,
    body: { access_token: session.access_token, refresh_token: session.refresh_token },
  };
}

export async function openBookerSession(pin: string): Promise<GateResult> {
  const admin = adminClient();
  if (!/^\d{4,8}$/.test(pin)) return { status: 401, body: { error: "Ongeldige pincode" } };
  const hash = await pinHash("booker", pin);
  if (pinAttemptBlocked(await failures(admin, hash))) {
    return { status: 429, body: { error: "Te veel pogingen. Wacht een kwartier." } };
  }
  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name, company_name, meeting_discount_percentage")
    .eq("booking_pin_code", pin)
    .neq("booking_pin_code", "")
    .limit(1);
  let userType: "tenant" | "external" = "tenant";
  let row = tenants?.[0] as { id: string; name?: string; company_name?: string; meeting_discount_percentage?: number } | undefined;
  if (!row) {
    const { data: externals } = await admin
      .from("external_customers")
      .select("id, company_name, contact_name, meeting_discount_percentage")
      .eq("booking_pin_code", pin)
      .neq("booking_pin_code", "")
      .limit(1);
    row = externals?.[0] as typeof row;
    userType = "external";
  }
  if (!row?.id) {
    await noteFailure(admin, hash);
    return { status: 401, body: { error: "Ongeldige pincode" } };
  }
  const session = await ensureBookerSession(admin, row.id, userType);
  await clearFailures(admin, hash);
  await markReady(admin, "booking_gate_ready");
  return {
    status: 200,
    body: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      profile: bookerProfile({ ...row, userType }),
    },
  };
}

export function gateResponse(result: GateResult): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function gateError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  const status = /missing service role/i.test(message) ? 503 : 500;
  return new Response(JSON.stringify({ error: "De controle is niet beschikbaar." }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
