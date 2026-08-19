import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const results: Record<string, string> = {};

  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const { error: completeError } = await supabase
      .from("meeting_room_bookings")
      .update({ status: "completed" })
      .eq("status", "confirmed")
      .lt("booking_date", todayStr);
    results.complete_past_bookings = completeError ? completeError.message : "ok";

    const { data: settings, error: settingsError } = await supabase
      .from("company_settings")
      .select("id, company_name, address, postal_code, city, email, phone, vat_number, kvk_number, test_mode, smtp_enabled, graph_enabled, eboekhouden_enabled")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!settingsError && settings) {
      const { error: backupError } = await supabase.from("settings_backups").insert({ payload: settings });
      results.settings_backup = backupError ? backupError.message : "ok";
    } else {
      results.settings_backup = settingsError?.message || "no settings";
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return new Response(JSON.stringify({ success: false, error: message, results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
