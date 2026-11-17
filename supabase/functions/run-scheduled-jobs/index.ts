import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/*
  Deze functie maakt geen facturen meer aan.

  De uurtaak draait via GitHub Actions (scripts/run-scheduled-jobs.ts) en
  volgt dezelfde regels als de app, inclusief de testdatum. Een oudere
  versie van deze functie deed dat niet. Als die toch werd aangeroepen,
  kon ze facturen met de oude regels wegschrijven.

  Aanroepen doet niets met de database en geeft alleen deze uitleg terug.
*/
Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: true,
      skipped: true,
      message: "Deze Supabase-functie maakt geen facturen aan. De uurtaak draait via GitHub Actions.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
