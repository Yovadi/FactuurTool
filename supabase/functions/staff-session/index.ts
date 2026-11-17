import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, gateError, gateResponse, openStaffSession } from "../_shared/openGate.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    return gateResponse(await openStaffSession(String(body?.pin || "")));
  } catch (error) {
    return gateError(error);
  }
});
