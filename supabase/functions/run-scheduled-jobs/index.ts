import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { amsterdamNextMonthStart } from "../../../src/utils/amsterdamCalendar.ts";
import { buildLeaseRentDraft } from "../../../src/utils/leaseRentDraft.ts";
import { buildMeetingInvoiceDraft, groupMeetingBookings, previousAmsterdamMonth } from "../../../src/utils/meetingInvoiceDraft.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SKIP_JOB_TYPES = new Set([
  "eboekhouden_payment_status_check",
  "eboekhouden_sync_verification",
  "eboekhouden_relation_verification",
  "generate_flex_invoices",
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

async function claimJob(supabase: SupabaseClient, job: Job): Promise<boolean> {
  const now = new Date().toISOString();
  const until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("scheduled_jobs")
    .update({ next_run_at: until })
    .eq("id", job.id)
    .lte("next_run_at", now)
    .select("id")
    .maybeSingle();
  return !!data;
}

async function advanceJobToNextMonth(supabase: SupabaseClient, job: Job) {
  await supabase
    .from("scheduled_jobs")
    .update({ last_run_at: new Date().toISOString(), next_run_at: amsterdamNextMonthStart().toISOString() })
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
    .select("*, tenant:tenants(lease_discount_percentage), lease_spaces(*, space:office_spaces(*))")
    .eq("status", "active");

  const { data: existingLeaseInvoices } = await supabase
    .from("invoices")
    .select("lease_id, invoice_month, notes")
    .not("lease_id", "is", null);

  const invoiceIndex = existingLeaseInvoices || [];

  for (const lease of leases || []) {
    const draft = buildLeaseRentDraft(lease, invoiceIndex);
    if (!draft) continue;

    const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");
    const { data: newInvoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        lease_id: lease.id,
        tenant_id: lease.tenant_id,
        invoice_number: invoiceNumber,
        invoice_date: draft.invoiceDate,
        due_date: draft.dueDate,
        invoice_month: draft.invoiceMonth,
        subtotal: draft.subtotal,
        vat_amount: draft.vatAmount,
        amount: draft.amount,
        vat_rate: draft.vatRate,
        vat_inclusive: draft.vatInclusive,
        status: "draft",
        notes: draft.notes,
      })
      .select()
      .single();
    if (invoiceError || !newInvoice) continue;
    invoiceIndex.push({ lease_id: lease.id, invoice_month: draft.invoiceMonth, notes: draft.notes });

    const { error: lineError } = await supabase.from("invoice_line_items").insert(
      draft.lines.map((line) => ({ ...line, invoice_id: newInvoice.id })),
    );
    if (lineError) await supabase.from("invoices").delete().eq("id", newInvoice.id);
  }

  await advanceJobToNextMonth(supabase, job);
}

async function generateMeetingRoomInvoices(supabase: SupabaseClient, job: Job) {
  const period = previousAmsterdamMonth();
  const { data: bookings } = await supabase
    .from("meeting_room_bookings")
    .select(`
      id, booking_date, start_time, end_time, total_hours, applied_rate, hourly_rate, rate_type,
      total_amount, discount_amount, vat_rate, tenant_id, external_customer_id,
      office_spaces(space_number),
      tenants(vat_rate, meeting_discount_percentage),
      external_customers(vat_rate, meeting_discount_percentage)
    `)
    .is("invoice_id", null)
    .in("status", ["confirmed", "completed"])
    .gte("booking_date", period.start)
    .lte("booking_date", period.end);

  if (!bookings || bookings.length === 0) {
    await advanceJobToNextMonth(supabase, job);
    return;
  }

  for (const group of groupMeetingBookings(bookings)) {
    const draft = buildMeetingInvoiceDraft(group.bookings, group.vatRate, group.discountPct, period.yearMonth);
    if (!draft) continue;
    const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");
    const insertData: Record<string, unknown> = {
      invoice_number: invoiceNumber,
      invoice_date: draft.invoiceDate,
      due_date: draft.dueDate,
      invoice_month: draft.invoiceMonth,
      status: "draft",
      subtotal: draft.subtotal,
      vat_amount: draft.vatAmount,
      vat_rate: draft.vatRate,
      vat_inclusive: false,
      amount: draft.amount,
      notes: draft.notes,
    };
    if (group.customerType === "tenant") insertData.tenant_id = group.customerId;
    else insertData.external_customer_id = group.customerId;
    const { data: newInvoice } = await supabase.from("invoices").insert(insertData).select("id").single();
    if (!newInvoice) continue;
    const { error: lineError } = await supabase.from("invoice_line_items").insert(
      draft.lines.map((line) => ({ ...line, invoice_id: newInvoice.id })),
    );
    if (lineError) {
      await supabase.from("invoices").delete().eq("id", newInvoice.id);
      continue;
    }
    const bookingIds = group.bookings.map((booking) => booking.id).filter((id): id is string => !!id);
    if (bookingIds.length > 0) {
      await supabase.from("meeting_room_bookings").update({ invoice_id: newInvoice.id }).in("id", bookingIds);
    }
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
    if (job.job_type === "send_invoice_reminders") {
      await supabase.from("scheduled_jobs").update({ is_enabled: false }).eq("id", job.id);
      results[job.job_type] = "disabled";
      continue;
    }
    if (SKIP_JOB_TYPES.has(job.job_type)) {
      results[job.job_type] = "skipped";
      continue;
    }
    if (!(await claimJob(supabase, job))) {
      results[job.job_type] = "claimed";
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
