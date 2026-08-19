import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SKIP_JOB_TYPES = new Set([
  "eboekhouden_payment_status_check",
  "eboekhouden_sync_verification",
  "eboekhouden_relation_verification",
  "send_invoice_reminders",
]);

const SECRET_KEYS = [
  "smtp_password",
  "smtp_user",
  "graph_client_secret",
  "resend_api_key",
  "eboekhouden_api_token",
  "openai_api_key",
  "staff_pin_code",
  "delete_code",
  "wifi_password",
];

type Job = {
  id: string;
  job_type: string;
  last_run_at: string | null;
  next_run_at: string | null;
  is_enabled: boolean;
};

function getLocalCategory(spaceType?: string): string | null {
  switch (spaceType) {
    case "kantoor":
      return "huur_kantoor";
    case "bedrijfsruimte":
      return "huur_bedrijfsruimte";
    case "buitenterrein":
      return "huur_buitenterrein";
    case "diversen":
      return "diversen";
    default:
      return null;
  }
}

function calculateVAT(amount: number, vatRate: number, vatInclusive: boolean) {
  if (vatInclusive) {
    const subtotal = Math.round((amount / (1 + vatRate / 100)) * 100) / 100;
    const vatAmount = Math.round((amount - subtotal) * 100) / 100;
    return { subtotal, vatAmount, total: Math.round(amount * 100) / 100 };
  }
  const subtotal = Math.round(amount * 100) / 100;
  const vatAmount = Math.round((amount * (vatRate / 100)) * 100) / 100;
  return { subtotal, vatAmount, total: Math.round((subtotal + vatAmount) * 100) / 100 };
}

function redactSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...settings };
  for (const key of SECRET_KEYS) {
    if (key in copy && copy[key]) copy[key] = "[redacted]";
  }
  return copy;
}

async function advanceJobNextRun(supabase: SupabaseClient, job: Job, intervalHours: number) {
  const next = new Date();
  next.setHours(next.getHours() + intervalHours);
  await supabase
    .from("scheduled_jobs")
    .update({ last_run_at: new Date().toISOString(), next_run_at: next.toISOString() })
    .eq("id", job.id);
}

async function advanceJobToNextMonth(supabase: SupabaseClient, job: Job) {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);
  await supabase
    .from("scheduled_jobs")
    .update({ last_run_at: new Date().toISOString(), next_run_at: nextMonth.toISOString() })
    .eq("id", job.id);
}

async function createLeaseNotification(
  supabase: SupabaseClient,
  type: "lease_expiring_30" | "lease_expiring_60" | "rent_indexation_applied",
  tenantName: string,
  details: string,
  tenantId?: string,
) {
  const titles = {
    lease_expiring_30: "Contract verloopt binnen 30 dagen",
    lease_expiring_60: "Contract verloopt binnen 60 dagen",
    rent_indexation_applied: "Huurprijsverhoging doorgevoerd",
  };
  const messages = {
    lease_expiring_30: `Contract van ${tenantName} verloopt binnenkort: ${details}`,
    lease_expiring_60: `Contract van ${tenantName} verloopt over ca. 2 maanden: ${details}`,
    rent_indexation_applied: `Huurprijs van ${tenantName} is verhoogd: ${details}`,
  };
  await supabase.from("admin_notifications").insert({
    notification_type: type,
    title: titles[type],
    message: messages[type],
    booking_type: null,
    booking_id: null,
    tenant_id: tenantId || null,
    external_customer_id: null,
    is_read: false,
  });
}

async function completePastBookings(supabase: SupabaseClient, job: Job) {
  const todayStr = new Date().toISOString().split("T")[0];
  await supabase
    .from("meeting_room_bookings")
    .update({ status: "completed" })
    .eq("status", "confirmed")
    .lt("booking_date", todayStr);
  await advanceJobNextRun(supabase, job, 24);
}

async function runSettingsBackup(supabase: SupabaseClient, job: Job) {
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!error && data) {
    await supabase.from("settings_backups").insert({
      payload: redactSettings(data as Record<string, unknown>),
    });
  }
  await advanceJobNextRun(supabase, job, 24);
}

async function checkExpiringLeases(supabase: SupabaseClient, job: Job) {
  const today = new Date();
  const in60Days = new Date(today);
  in60Days.setDate(in60Days.getDate() + 60);
  const todayStr = today.toISOString().split("T")[0];
  const in60Str = in60Days.toISOString().split("T")[0];

  const { data: leases } = await supabase
    .from("leases")
    .select("id, end_date, tenant_id, tenant:tenants(company_name)")
    .eq("status", "active")
    .gte("end_date", todayStr)
    .lte("end_date", in60Str);

  for (const lease of leases || []) {
    const endDate = new Date(`${lease.end_date}T00:00:00`);
    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const tenantName = (lease.tenant as { company_name?: string } | null)?.company_name || "Onbekende huurder";
    const endDateStr = endDate.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });

    const { data: existingNotif } = await supabase
      .from("admin_notifications")
      .select("id")
      .eq("tenant_id", lease.tenant_id)
      .in("notification_type", ["lease_expiring_30", "lease_expiring_60"])
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();
    if (existingNotif) continue;

    if (diffDays <= 30) {
      await createLeaseNotification(
        supabase,
        "lease_expiring_30",
        tenantName,
        `Einddatum: ${endDateStr} (nog ${diffDays} dagen)`,
        lease.tenant_id,
      );
    } else if (diffDays <= 60) {
      await createLeaseNotification(
        supabase,
        "lease_expiring_60",
        tenantName,
        `Einddatum: ${endDateStr} (nog ${diffDays} dagen)`,
        lease.tenant_id,
      );
    }
  }
  await advanceJobNextRun(supabase, job, 24);
}

async function applyRentIndexation(supabase: SupabaseClient, job: Job) {
  const { data: settings } = await supabase
    .from("company_settings")
    .select("rent_indexation_percentage")
    .maybeSingle();
  const percentage = Number(settings?.rent_indexation_percentage ?? 0);
  if (!percentage || percentage <= 0) {
    await advanceJobNextRun(supabase, job, 24);
    return;
  }

  const currentYearStart = `${new Date().getFullYear()}-01-01`;
  const { data: leases } = await supabase
    .from("leases")
    .select("id, tenant_id, last_indexation_at, tenant:tenants(company_name), lease_spaces(*)")
    .eq("status", "active")
    .eq("lease_type", "full_time");

  for (const lease of leases || []) {
    if (lease.last_indexation_at && lease.last_indexation_at >= currentYearStart) continue;
    const multiplier = 1 + percentage / 100;
    const tenantName = (lease.tenant as { company_name?: string } | null)?.company_name || "Onbekende huurder";
    let totalOld = 0;
    let totalNew = 0;
    for (const ls of lease.lease_spaces || []) {
      const oldRent = Number(ls.monthly_rent);
      const newRent = Math.round(oldRent * multiplier * 100) / 100;
      const oldPricePerSqm = Number(ls.price_per_sqm);
      const newPricePerSqm = Math.round(oldPricePerSqm * multiplier * 100) / 100;
      await supabase
        .from("lease_spaces")
        .update({ monthly_rent: newRent, price_per_sqm: newPricePerSqm })
        .eq("id", ls.id);
      totalOld += oldRent;
      totalNew += newRent;
    }
    await supabase
      .from("leases")
      .update({ last_indexation_at: new Date().toISOString().split("T")[0] })
      .eq("id", lease.id);
    await createLeaseNotification(
      supabase,
      "rent_indexation_applied",
      tenantName,
      `${percentage}% verhoging: €${totalOld.toFixed(2)} → €${totalNew.toFixed(2)}/maand`,
      lease.tenant_id,
    );
  }

  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  nextYear.setMonth(0, 1);
  nextYear.setHours(0, 0, 0, 0);
  await supabase
    .from("scheduled_jobs")
    .update({ last_run_at: new Date().toISOString(), next_run_at: nextYear.toISOString() })
    .eq("id", job.id);
}

async function generateMonthlyInvoices(supabase: SupabaseClient, job: Job) {
  const { data: leases } = await supabase
    .from("leases")
    .select("*, tenant:tenants(*), lease_spaces(*, space:office_spaces(*))")
    .eq("status", "active");

  if (!leases || leases.length === 0) {
    await advanceJobToNextMonth(supabase, job);
    return;
  }

  const invoiceMonth = new Date().toISOString().slice(0, 7);
  const invoiceDate = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  for (const lease of leases) {
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("lease_id", lease.id)
      .eq("invoice_month", invoiceMonth)
      .maybeSingle();
    if (existingInvoice) continue;

    const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");
    let baseAmount = Math.round(
      (lease.lease_spaces || []).reduce((sum: number, ls: { monthly_rent: number }) => sum + Number(ls.monthly_rent), 0) * 100,
    ) / 100;
    baseAmount = Math.round((baseAmount + (lease.security_deposit || 0)) * 100) / 100;
    const { subtotal, vatAmount, total } = calculateVAT(baseAmount, lease.vat_rate, lease.vat_inclusive);

    const { data: newInvoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        lease_id: lease.id,
        tenant_id: lease.tenant_id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        invoice_month: invoiceMonth,
        subtotal,
        vat_amount: vatAmount,
        amount: total,
        vat_rate: lease.vat_rate,
        vat_inclusive: lease.vat_inclusive,
        status: "draft",
        notes: null,
      })
      .select()
      .single();
    if (invoiceError || !newInvoice) continue;

    const lineItemsToInsert = [];
    for (const ls of lease.lease_spaces || []) {
      const spaceName = ls.space?.space_number || "Ruimte";
      const spaceType = ls.space?.space_type;
      let displayName = spaceName;
      if (spaceType === "bedrijfsruimte") {
        const numOnly = spaceName.replace(/^(Bedrijfsruimte|Hal)\s*/i, "").trim();
        if (/^\d+/.test(numOnly)) displayName = `Hal ${numOnly}`;
      }
      const sqm = ls.space?.square_footage || 1;
      const pricePerSqm = sqm > 0 ? Math.round((ls.monthly_rent / sqm) * 100) / 100 : ls.monthly_rent;
      lineItemsToInsert.push({
        invoice_id: newInvoice.id,
        description: displayName,
        quantity: sqm,
        unit_price: pricePerSqm,
        amount: ls.monthly_rent,
        local_category: getLocalCategory(spaceType),
      });
    }
    if (lease.security_deposit > 0) {
      lineItemsToInsert.push({
        invoice_id: newInvoice.id,
        description: "Voorschot Gas, Water & Electra",
        quantity: 1,
        unit_price: lease.security_deposit,
        amount: lease.security_deposit,
        local_category: "diversen",
      });
    }
    if (lineItemsToInsert.length > 0) {
      await supabase.from("invoice_line_items").insert(lineItemsToInsert);
    }
  }

  await advanceJobToNextMonth(supabase, job);
}

async function generateMeetingRoomInvoices(supabase: SupabaseClient, job: Job) {
  const prevMonth = new Date();
  prevMonth.setDate(1);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const targetMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

  const { data: rates } = await supabase
    .from("space_type_rates")
    .select("vat_inclusive")
    .eq("space_type", "vergaderruimte")
    .maybeSingle();
  const vatInclusive = rates?.vat_inclusive ?? false;
  const defaultVatRate = 21;

  const { data: bookings } = await supabase
    .from("meeting_room_bookings")
    .select("*, office_spaces(space_number)")
    .is("invoice_id", null)
    .in("status", ["confirmed", "completed"])
    .gte("booking_date", `${targetMonth}-01`)
    .lte("booking_date", `${targetMonth}-31`);

  if (!bookings || bookings.length === 0) {
    await advanceJobToNextMonth(supabase, job);
    return;
  }

  const grouped: Record<string, { customerId: string; customerType: "tenant" | "external"; bookings: typeof bookings }> = {};
  for (const b of bookings) {
    const key = b.booking_type === "tenant" ? `tenant_${b.tenant_id}` : `external_${b.external_customer_id}`;
    if (!grouped[key]) {
      grouped[key] = {
        customerId: b.booking_type === "tenant" ? b.tenant_id : b.external_customer_id,
        customerType: b.booking_type === "tenant" ? "tenant" : "external",
        bookings: [],
      };
    }
    grouped[key].bookings.push(b);
  }

  const invoiceDate = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  for (const group of Object.values(grouped)) {
    const totalAmount = group.bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
    const vatRate = group.bookings[0].vat_rate ?? defaultVatRate;
    const { subtotal, vatAmount, total } = calculateVAT(totalAmount, vatRate, vatInclusive);
    const notesLines = group.bookings.map((b) => {
      const spaceName = b.office_spaces?.space_number || "Vergaderruimte";
      const dateStr = new Date(`${b.booking_date}T00:00:00`).toLocaleDateString("nl-NL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const timeStr = `${b.start_time.substring(0, 5)}-${b.end_time.substring(0, 5)}`;
      return `- ${spaceName} ${dateStr} ${timeStr} = €${Number(b.total_amount).toFixed(2)}`;
    });
    const notes = `Vergaderruimte boekingen:\n${notesLines.join("\n")}`;

    const existingQuery = supabase
      .from("invoices")
      .select("id, subtotal, vat_amount, amount, notes")
      .eq("invoice_month", targetMonth)
      .eq("status", "draft");
    const existingResult = group.customerType === "tenant"
      ? await existingQuery.eq("tenant_id", group.customerId).maybeSingle()
      : await existingQuery.eq("external_customer_id", group.customerId).maybeSingle();

    let invoiceId: string;
    if (existingResult.data) {
      const existing = existingResult.data;
      const newSubtotal = Math.round((Number(existing.subtotal) + subtotal) * 100) / 100;
      const newVat = Math.round((newSubtotal * vatRate / 100) * 100) / 100;
      const newTotal = Math.round((newSubtotal + newVat) * 100) / 100;
      const updatedNotes = existing.notes ? `${existing.notes}\n${notes}` : notes;
      await supabase.from("invoices").update({
        subtotal: newSubtotal,
        vat_amount: newVat,
        amount: newTotal,
        notes: updatedNotes,
      }).eq("id", existing.id);
      invoiceId = existing.id;
    } else {
      const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");
      const insertData: Record<string, unknown> = {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        invoice_month: targetMonth,
        status: "draft",
        subtotal,
        vat_amount: vatAmount,
        vat_rate: vatRate,
        vat_inclusive: vatInclusive,
        amount: total,
        notes,
      };
      if (group.customerType === "tenant") insertData.tenant_id = group.customerId;
      else insertData.external_customer_id = group.customerId;
      const { data: newInvoice } = await supabase.from("invoices").insert(insertData).select("id").single();
      if (!newInvoice) continue;
      invoiceId = newInvoice.id;
    }

    await supabase.from("meeting_room_bookings").update({ invoice_id: invoiceId }).in("id", group.bookings.map((b) => b.id));
  }

  await advanceJobToNextMonth(supabase, job);
}

async function runDueJobs(supabase: SupabaseClient) {
  const { data: jobs, error } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .eq("is_enabled", true)
    .lte("next_run_at", new Date().toISOString());

  if (error) throw new Error(error.message);

  const results: Record<string, string> = {};
  for (const job of (jobs || []) as Job[]) {
    if (SKIP_JOB_TYPES.has(job.job_type)) {
      results[job.job_type] = "skipped";
      continue;
    }
    try {
      if (job.job_type === "generate_monthly_invoices") await generateMonthlyInvoices(supabase, job);
      else if (job.job_type === "generate_meeting_room_invoices") await generateMeetingRoomInvoices(supabase, job);
      else if (job.job_type === "check_expiring_leases") await checkExpiringLeases(supabase, job);
      else if (job.job_type === "apply_rent_indexation") await applyRentIndexation(supabase, job);
      else if (job.job_type === "complete_past_bookings") await completePastBookings(supabase, job);
      else if (job.job_type === "settings_backup") await runSettingsBackup(supabase, job);
      else {
        results[job.job_type] = "unknown";
        continue;
      }
      results[job.job_type] = "ok";
    } catch (error) {
      results[job.job_type] = error instanceof Error ? error.message : "onbekende fout";
    }
  }
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const results = await runDueJobs(supabase);
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
