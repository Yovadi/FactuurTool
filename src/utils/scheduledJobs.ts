import { supabase } from '../lib/supabase';
import { checkInvoicePaymentStatuses, checkPurchaseInvoicePaymentStatuses, verifyInvoiceSyncStatus, verifyRelationsInEBoekhouden } from '../lib/eboekhoudenSync';
import { createLeaseNotification } from './notificationHelper';
import { createSettingsBackup } from './settingsBackup';
import { addCalendarDays, amsterdamInstant, amsterdamNextMonthStart } from './amsterdamCalendar';
import { getCurrentDate, getCurrentDateString } from './dateHelpers';
import { buildLeaseRentDraft } from './leaseRentDraft';
import { pendingIndexation } from './rentIndexation';
import { buildMeetingInvoiceDraft, groupMeetingBookings, previousAmsterdamMonth } from './meetingInvoiceDraft';

export { SERVER_SKIP_JOB_TYPES, runsOnServer } from './serverJobTypes';

export interface ScheduledJob {
  id: string;
  job_type: string;
  last_run_at: string | null;
  next_run_at: string | null;
  is_enabled: boolean;
  created_at: string;
}

export const checkAndRunScheduledJobs = async (options?: { skip?: Set<string>; strict?: boolean }): Promise<string[]> => {
  const ran: string[] = [];
  const { data: jobs, error } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('is_enabled', true)
    .lte('next_run_at', new Date().toISOString());

  if (error || !jobs) {
    if (options?.strict) {
      throw new Error(error?.message || 'De takenlijst kon niet worden gelezen.');
    }
    return ran;
  }

  for (const job of jobs) {
    if (job.job_type === 'send_invoice_reminders') {
      await supabase.from('scheduled_jobs').update({ is_enabled: false }).eq('id', job.id);
      continue;
    }
    if (options?.skip?.has(job.job_type)) continue;
    if (!(await claimScheduledJob(job))) continue;
    ran.push(job.job_type);
    if (job.job_type === 'generate_monthly_invoices') {
      await generateMonthlyInvoices(job);
    } else if (job.job_type === 'generate_meeting_room_invoices') {
      await generateMeetingRoomInvoices(job);
    } else if (job.job_type === 'eboekhouden_payment_status_check') {
      await runEBoekhoudenPaymentStatusCheck(job);
    } else if (job.job_type === 'eboekhouden_sync_verification') {
      await runEBoekhoudenSyncVerification(job);
    } else if (job.job_type === 'eboekhouden_relation_verification') {
      await runEBoekhoudenRelationVerification(job);
    } else if (job.job_type === 'check_expiring_leases') {
      await checkExpiringLeases(job);
    } else if (job.job_type === 'apply_rent_indexation') {
      await applyRentIndexation(job);
    } else if (job.job_type === 'complete_past_bookings') {
      await completePastBookings(job);
    } else if (job.job_type === 'settings_backup') {
      await runSettingsBackup(job);
    }
  }

  return ran;
};

async function getEBoekhoudenToken(): Promise<string | null> {
  const { data: settings } = await supabase
    .from('company_settings')
    .select('eboekhouden_api_token, eboekhouden_connected')
    .maybeSingle();
  if (!settings?.eboekhouden_connected || !settings?.eboekhouden_api_token) return null;
  return settings.eboekhouden_api_token;
}

async function claimScheduledJob(job: ScheduledJob): Promise<boolean> {
  const now = new Date().toISOString();
  const until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('scheduled_jobs')
    .update({ next_run_at: until })
    .eq('id', job.id)
    .lte('next_run_at', now)
    .select('id')
    .maybeSingle();
  return !!data;
}

async function advanceJobToNextMonth(job: ScheduledJob) {
  await supabase
    .from('scheduled_jobs')
    .update({ last_run_at: new Date().toISOString(), next_run_at: amsterdamNextMonthStart().toISOString() })
    .eq('id', job.id);
}

async function advanceJobNextRun(job: ScheduledJob, intervalHours: number) {
  const next = new Date();
  next.setHours(next.getHours() + intervalHours);
  await supabase
    .from('scheduled_jobs')
    .update({ last_run_at: new Date().toISOString(), next_run_at: next.toISOString() })
    .eq('id', job.id);
}

const runEBoekhoudenPaymentStatusCheck = async (job: ScheduledJob) => {
  try {
    const token = await getEBoekhoudenToken();
    if (!token) {
      await advanceJobNextRun(job, 24);
      return;
    }
    await checkInvoicePaymentStatuses(token);
    await checkPurchaseInvoicePaymentStatuses(token);
    await advanceJobNextRun(job, 24);
  } catch (error) {
    console.error('Error running e-Boekhouden payment status check:', error);
  }
};

const runEBoekhoudenSyncVerification = async (job: ScheduledJob) => {
  try {
    const token = await getEBoekhoudenToken();
    if (!token) {
      await advanceJobNextRun(job, 24);
      return;
    }
    await verifyInvoiceSyncStatus(token);
    await advanceJobNextRun(job, 24);
  } catch (error) {
    console.error('Error running e-Boekhouden sync verification:', error);
  }
};

const runEBoekhoudenRelationVerification = async (job: ScheduledJob) => {
  try {
    const token = await getEBoekhoudenToken();
    if (!token) {
      await advanceJobNextRun(job, 24);
      return;
    }
    await verifyRelationsInEBoekhouden(token);
    await advanceJobNextRun(job, 24);
  } catch (error) {
    console.error('Error running e-Boekhouden relation verification:', error);
  }
};

// Groups bookings by customer, creates/updates one draft invoice per customer per month
const generateMeetingRoomInvoices = async (job: ScheduledJob) => {
  try {
    const clock = await getCurrentDate();
    const period = previousAmsterdamMonth(clock);
    const { data: bookings } = await supabase
      .from('meeting_room_bookings')
      .select(`
        id, booking_date, start_time, end_time, total_hours, applied_rate, hourly_rate, rate_type,
        total_amount, discount_amount, vat_rate, tenant_id, external_customer_id,
        office_spaces(space_number),
        tenants(vat_rate, meeting_discount_percentage),
        external_customers(vat_rate, meeting_discount_percentage)
      `)
      .is('invoice_id', null)
      .in('status', ['confirmed', 'completed'])
      .gte('booking_date', period.start)
      .lte('booking_date', period.end);

    if (!bookings || bookings.length === 0) {
      await advanceJobToNextMonth(job);
      return;
    }

    let failed = false;
    for (const group of groupMeetingBookings(bookings)) {
      const draft = buildMeetingInvoiceDraft(group.bookings, group.vatRate, group.discountPct, period.yearMonth, clock);
      if (!draft) continue;
      const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');
      const insertData: Record<string, unknown> = {
        invoice_number: invoiceNumber,
        invoice_date: draft.invoiceDate,
        due_date: draft.dueDate,
        invoice_month: draft.invoiceMonth,
        status: 'draft',
        subtotal: draft.subtotal,
        vat_amount: draft.vatAmount,
        vat_rate: draft.vatRate,
        vat_inclusive: false,
        amount: draft.amount,
        notes: draft.notes,
      };
      if (group.customerType === 'tenant') insertData.tenant_id = group.customerId;
      else insertData.external_customer_id = group.customerId;

      const { data: newInvoice } = await supabase.from('invoices').insert(insertData).select('id').single();
      if (!newInvoice) {
        failed = true;
        continue;
      }
      const { error: lineError } = await supabase.from('invoice_line_items').insert(
        draft.lines.map((line) => ({ ...line, invoice_id: newInvoice.id })),
      );
      if (lineError) {
        await supabase.from('invoices').delete().eq('id', newInvoice.id);
        failed = true;
        continue;
      }
      await supabase
        .from('meeting_room_bookings')
        .update({ invoice_id: newInvoice.id })
        .in('id', group.bookings.map((booking) => booking.id).filter((id): id is string => !!id));
    }

    if (!failed) await advanceJobToNextMonth(job);
  } catch (error) {
    console.error('Error generating meeting room invoices:', error);
  }
};

const checkExpiringLeases = async (job: ScheduledJob) => {
  try {
    const todayStr = await getCurrentDateString();
    const in60Str = addCalendarDays(todayStr, 60);

    const { data: leases } = await supabase
      .from('leases')
      .select('id, end_date, tenant_id, tenant:tenants(company_name)')
      .eq('status', 'active')
      .gte('end_date', todayStr)
      .lte('end_date', in60Str);

    if (!leases) {
      await advanceJobNextRun(job, 24);
      return;
    }

    for (const lease of leases as any[]) {
      const endDate = new Date(lease.end_date + 'T00:00:00');
      const diffDays = Math.round(
        (Date.parse(`${lease.end_date}T00:00:00Z`) - Date.parse(`${todayStr}T00:00:00Z`)) / 86400000,
      );
      const tenantName = lease.tenant?.company_name || 'Onbekende huurder';
      const endDateStr = endDate.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const { data: existingNotif } = await supabase
        .from('admin_notifications')
        .select('id')
        .eq('tenant_id', lease.tenant_id)
        .in('notification_type', ['lease_expiring_30', 'lease_expiring_60'])
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existingNotif) continue;

      if (diffDays <= 30) {
        await createLeaseNotification(
          'lease_expiring_30',
          lease.id,
          tenantName,
          `Einddatum: ${endDateStr} (nog ${diffDays} dagen)`,
          lease.tenant_id
        );
      } else if (diffDays <= 60) {
        await createLeaseNotification(
          'lease_expiring_60',
          lease.id,
          tenantName,
          `Einddatum: ${endDateStr} (nog ${diffDays} dagen)`,
          lease.tenant_id
        );
      }
    }

    await advanceJobNextRun(job, 24);
  } catch (error) {
    console.error('Error checking expiring leases:', error);
  }
};

const applyRentIndexation = async (job: ScheduledJob) => {
  try {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('rent_indexation_percentage')
      .maybeSingle();

    const percentage = settings?.rent_indexation_percentage ?? 0;
    if (!percentage || percentage <= 0) {
      await advanceJobNextRun(job, 24);
      return;
    }

    const todayStr = await getCurrentDateString();
    const currentYear = Number(todayStr.slice(0, 4));
    const currentYearStart = `${currentYear}-01-01`;

    const { data: leases } = await supabase
      .from('leases')
      .select('id, tenant_id, last_indexation_at, tenant:tenants(company_name), lease_spaces(*)')
      .eq('status', 'active')
      .eq('lease_type', 'full_time');

    if (!leases) {
      await advanceJobNextRun(job, 24);
      return;
    }

    const pending = pendingIndexation(
      (leases as any[]).map((lease) => {
        const tenant = Array.isArray(lease.tenant) ? lease.tenant[0] : lease.tenant;
        return {
          id: lease.id,
          tenant_id: lease.tenant_id,
          tenantName: tenant?.company_name || 'Onbekende huurder',
          last_indexation_at: lease.last_indexation_at,
          spaces: (lease.lease_spaces || []).map((space: any) => ({
            id: space.id,
            monthly_rent: Number(space.monthly_rent) || 0,
            price_per_sqm: Number(space.price_per_sqm) || 0,
          })),
        };
      }),
      percentage,
      currentYearStart
    );

    if (pending.length > 0) {
      const yearStart = amsterdamInstant(currentYear, 1, 1, 0, 0).toISOString();
      const { data: existing } = await supabase
        .from('admin_notifications')
        .select('id')
        .eq('notification_type', 'rent_indexation_ready')
        .gte('created_at', yearStart)
        .limit(1);

      if (!existing?.length) {
        await supabase.from('admin_notifications').insert({
          notification_type: 'rent_indexation_ready',
          title: 'Huurprijsverhoging staat klaar',
          message: `${pending.length} contracten kunnen met ${percentage}% omhoog. Voer de verhoging door bij Automatiseringen.`,
          is_read: false,
        });
      }
    }

    const nextYear = amsterdamInstant(currentYear + 1, 1, 1, 0, 15);

    await supabase
      .from('scheduled_jobs')
      .update({ last_run_at: new Date().toISOString(), next_run_at: nextYear.toISOString() })
      .eq('id', job.id);
  } catch (error) {
    console.error('Error applying rent indexation:', error);
  }
};

const completePastBookings = async (job: ScheduledJob) => {
  try {
    const todayStr = await getCurrentDateString();

    await supabase
      .from('meeting_room_bookings')
      .update({ status: 'completed' })
      .eq('status', 'confirmed')
      .lt('booking_date', todayStr);

    await advanceJobNextRun(job, 24);
  } catch (error) {
    console.error('Error completing past bookings:', error);
  }
};

const runSettingsBackup = async (job: ScheduledJob) => {
  try {
    await createSettingsBackup();
    await advanceJobNextRun(job, 24);
  } catch (error) {
    console.error('Error creating settings backup:', error);
  }
};

const generateMonthlyInvoices = async (job: ScheduledJob) => {
  try {
    const clock = await getCurrentDate();
    const { data: leases } = await supabase
      .from('leases')
      .select(`
        *,
        tenant:tenants(lease_discount_percentage),
        lease_spaces(
          *,
          space:office_spaces(*)
        )
      `)
      .eq('status', 'active');

    const { data: existingLeaseInvoices } = await supabase
      .from('invoices')
      .select('lease_id, invoice_month, notes')
      .not('lease_id', 'is', null);

    const invoiceIndex = existingLeaseInvoices || [];
    let failed = false;

    for (const lease of leases || []) {
      const draft = buildLeaseRentDraft(lease, invoiceIndex, clock);
      if (!draft) continue;

      const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
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
          status: 'draft',
          notes: draft.notes,
        })
        .select()
        .single();

      if (invoiceError || !newInvoice) {
        failed = true;
        continue;
      }
      invoiceIndex.push({ lease_id: lease.id, invoice_month: draft.invoiceMonth, notes: draft.notes });

      const { error: lineError } = await supabase.from('invoice_line_items').insert(
        draft.lines.map((line) => ({ ...line, invoice_id: newInvoice.id })),
      );
      if (lineError) {
        await supabase.from('invoices').delete().eq('id', newInvoice.id);
        failed = true;
      }
    }

    if (!failed) await advanceJobToNextMonth(job);
  } catch (error) {
    console.error('Error generating monthly invoices:', error);
  }
};
