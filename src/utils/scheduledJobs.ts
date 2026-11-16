import { supabase } from '../lib/supabase';
import { checkInvoicePaymentStatuses, checkPurchaseInvoicePaymentStatuses, verifyInvoiceSyncStatus, verifyRelationsInEBoekhouden } from '../lib/eboekhoudenSync';
import { createLeaseNotification } from './notificationHelper';
import { sendInvoiceReminderEmails } from './invoiceReminders';
import { createSettingsBackup } from './settingsBackup';
import { amsterdamNextMonthStart } from './amsterdamCalendar';
import { buildLeaseRentDraft } from './leaseRentDraft';
import { buildMeetingInvoiceDraft, groupMeetingBookings, previousAmsterdamMonth } from './meetingInvoiceDraft';

export interface ScheduledJob {
  id: string;
  job_type: string;
  last_run_at: string | null;
  next_run_at: string | null;
  is_enabled: boolean;
  created_at: string;
}

export const checkAndRunScheduledJobs = async () => {
  const { data: jobs, error } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('is_enabled', true)
    .lte('next_run_at', new Date().toISOString());

  if (error || !jobs) return;

  for (const job of jobs) {
    if (!(await claimScheduledJob(job))) continue;
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
    } else if (job.job_type === 'send_invoice_reminders') {
      await runInvoiceReminders(job);
    } else if (job.job_type === 'settings_backup') {
      await runSettingsBackup(job);
    }
  }
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
    if (!token) return;
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
    if (!token) return;
    await verifyInvoiceSyncStatus(token);
    await advanceJobNextRun(job, 24);
  } catch (error) {
    console.error('Error running e-Boekhouden sync verification:', error);
  }
};

const runEBoekhoudenRelationVerification = async (job: ScheduledJob) => {
  try {
    const token = await getEBoekhoudenToken();
    if (!token) return;
    await verifyRelationsInEBoekhouden(token);
    await advanceJobNextRun(job, 24);
  } catch (error) {
    console.error('Error running e-Boekhouden relation verification:', error);
  }
};

// Groups bookings by customer, creates/updates one draft invoice per customer per month
const generateMeetingRoomInvoices = async (job: ScheduledJob) => {
  try {
    const period = previousAmsterdamMonth();
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

    for (const group of groupMeetingBookings(bookings)) {
      const draft = buildMeetingInvoiceDraft(group.bookings, group.vatRate, group.discountPct, period.yearMonth);
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
      if (!newInvoice) continue;
      const { error: lineError } = await supabase.from('invoice_line_items').insert(
        draft.lines.map((line) => ({ ...line, invoice_id: newInvoice.id })),
      );
      if (lineError) {
        await supabase.from('invoices').delete().eq('id', newInvoice.id);
        continue;
      }
      await supabase
        .from('meeting_room_bookings')
        .update({ invoice_id: newInvoice.id })
        .in('id', group.bookings.map((booking) => booking.id).filter((id): id is string => !!id));
    }

    await advanceJobToNextMonth(job);
  } catch (error) {
    console.error('Error generating meeting room invoices:', error);
  }
};

const checkExpiringLeases = async (job: ScheduledJob) => {
  try {
    const today = new Date();
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);
    const in60Days = new Date(today);
    in60Days.setDate(in60Days.getDate() + 60);

    const todayStr = today.toISOString().split('T')[0];
    const in30Str = in30Days.toISOString().split('T')[0];
    const in60Str = in60Days.toISOString().split('T')[0];

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
      const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

    const currentYear = new Date().getFullYear();
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

    for (const lease of leases as any[]) {
      if (lease.last_indexation_at && lease.last_indexation_at >= currentYearStart) continue;

      const multiplier = 1 + percentage / 100;
      const tenantName = lease.tenant?.company_name || 'Onbekende huurder';
      let totalOld = 0;
      let totalNew = 0;

      for (const ls of lease.lease_spaces) {
        const oldRent = Number(ls.monthly_rent);
        const newRent = Math.round(oldRent * multiplier * 100) / 100;
        const oldPricePerSqm = Number(ls.price_per_sqm);
        const newPricePerSqm = Math.round(oldPricePerSqm * multiplier * 100) / 100;

        await supabase
          .from('lease_spaces')
          .update({ monthly_rent: newRent, price_per_sqm: newPricePerSqm })
          .eq('id', ls.id);

        totalOld += oldRent;
        totalNew += newRent;
      }

      await supabase
        .from('leases')
        .update({ last_indexation_at: new Date().toISOString().split('T')[0] })
        .eq('id', lease.id);

      await createLeaseNotification(
        'rent_indexation_applied',
        lease.id,
        tenantName,
        `${percentage}% verhoging: €${totalOld.toFixed(2)} → €${totalNew.toFixed(2)}/maand`,
        lease.tenant_id
      );
    }

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    nextYear.setMonth(0);
    nextYear.setDate(1);
    nextYear.setHours(0, 0, 0, 0);

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
    const todayStr = new Date().toISOString().split('T')[0];

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

const runInvoiceReminders = async (job: ScheduledJob) => {
  try {
    await sendInvoiceReminderEmails();
    await advanceJobNextRun(job, 24);
  } catch (error) {
    console.error('Error sending invoice reminders:', error);
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

    for (const lease of leases || []) {
      const draft = buildLeaseRentDraft(lease, invoiceIndex);
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

      if (invoiceError || !newInvoice) continue;
      invoiceIndex.push({ lease_id: lease.id, invoice_month: draft.invoiceMonth, notes: draft.notes });

      const { error: lineError } = await supabase.from('invoice_line_items').insert(
        draft.lines.map((line) => ({ ...line, invoice_id: newInvoice.id })),
      );
      if (lineError) {
        await supabase.from('invoices').delete().eq('id', newInvoice.id);
      }
    }

    await advanceJobToNextMonth(job);
  } catch (error) {
    console.error('Error generating monthly invoices:', error);
  }
};
