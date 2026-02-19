import { supabase } from '../lib/supabase';
import { checkInvoicePaymentStatuses, checkPurchaseInvoicePaymentStatuses, verifyInvoiceSyncStatus, verifyRelationsInEBoekhouden } from '../lib/eboekhoudenSync';

function getLocalCategory(spaceType?: string): string | null {
  switch (spaceType) {
    case 'kantoor': return 'huur_kantoor';
    case 'bedrijfsruimte': return 'huur_bedrijfsruimte';
    case 'buitenterrein': return 'huur_buitenterrein';
    case 'flexplek': return 'flexplek';
    case 'diversen': return 'diversen';
    default: return null;
  }
}

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
    if (job.job_type === 'generate_monthly_invoices') {
      await generateMonthlyInvoices(job);
    } else if (job.job_type === 'generate_meeting_room_invoices') {
      await generateMeetingRoomInvoices(job);
    } else if (job.job_type === 'generate_flex_invoices') {
      await generateFlexInvoices(job);
    } else if (job.job_type === 'eboekhouden_payment_status_check') {
      await runEBoekhoudenPaymentStatusCheck(job);
    } else if (job.job_type === 'eboekhouden_sync_verification') {
      await runEBoekhoudenSyncVerification(job);
    } else if (job.job_type === 'eboekhouden_relation_verification') {
      await runEBoekhoudenRelationVerification(job);
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

async function advanceJobToNextMonth(job: ScheduledJob) {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);
  await supabase
    .from('scheduled_jobs')
    .update({ last_run_at: new Date().toISOString(), next_run_at: nextMonth.toISOString() })
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

function calculateVAT(amount: number, vatRate: number, vatInclusive: boolean) {
  if (vatInclusive) {
    const subtotal = Math.round((amount / (1 + vatRate / 100)) * 100) / 100;
    const vatAmount = Math.round((amount - subtotal) * 100) / 100;
    return { subtotal, vatAmount, total: Math.round(amount * 100) / 100 };
  } else {
    const subtotal = Math.round(amount * 100) / 100;
    const vatAmount = Math.round((amount * (vatRate / 100)) * 100) / 100;
    return { subtotal, vatAmount, total: Math.round((subtotal + vatAmount) * 100) / 100 };
  }
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
    const prevMonth = new Date();
    prevMonth.setDate(1);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const targetMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    const { data: rates } = await supabase
      .from('space_type_rates')
      .select('vat_inclusive')
      .eq('space_type', 'vergaderruimte')
      .maybeSingle();
    const vatInclusive = rates?.vat_inclusive ?? false;
    const defaultVatRate = 21;

    const { data: bookings } = await supabase
      .from('meeting_room_bookings')
      .select('*, office_spaces(space_number)')
      .is('invoice_id', null)
      .in('status', ['confirmed', 'completed'])
      .gte('booking_date', `${targetMonth}-01`)
      .lte('booking_date', `${targetMonth}-31`);

    if (!bookings || bookings.length === 0) {
      await advanceJobToNextMonth(job);
      return;
    }

    const grouped: Record<string, { customerId: string; customerType: 'tenant' | 'external'; bookings: typeof bookings }> = {};

    for (const b of bookings) {
      const key = b.booking_type === 'tenant' ? `tenant_${b.tenant_id}` : `external_${b.external_customer_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          customerId: b.booking_type === 'tenant' ? b.tenant_id : b.external_customer_id,
          customerType: b.booking_type === 'tenant' ? 'tenant' : 'external',
          bookings: [],
        };
      }
      grouped[key].bookings.push(b);
    }

    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const group of Object.values(grouped)) {
      const totalAmount = group.bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
      const vatRate = group.bookings[0].vat_rate ?? defaultVatRate;
      const { subtotal, vatAmount, total } = calculateVAT(totalAmount, vatRate, vatInclusive);

      const notesLines = group.bookings.map(b => {
        const spaceName = b.office_spaces?.space_number || 'Vergaderruimte';
        const dateStr = new Date(b.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = `${b.start_time.substring(0, 5)}-${b.end_time.substring(0, 5)}`;
        return `- ${spaceName} ${dateStr} ${timeStr} = €${Number(b.total_amount).toFixed(2)}`;
      });
      const notes = `Vergaderruimte boekingen:\n${notesLines.join('\n')}`;

      const existingQuery = supabase
        .from('invoices')
        .select('id, subtotal, vat_amount, amount, notes')
        .eq('invoice_month', targetMonth)
        .eq('status', 'draft');

      const existingResult = group.customerType === 'tenant'
        ? await existingQuery.eq('tenant_id', group.customerId).maybeSingle()
        : await existingQuery.eq('external_customer_id', group.customerId).maybeSingle();

      let invoiceId: string;

      if (existingResult.data) {
        const existing = existingResult.data;
        const newSubtotal = Math.round((Number(existing.subtotal) + subtotal) * 100) / 100;
        const newVat = Math.round((newSubtotal * vatRate / 100) * 100) / 100;
        const newTotal = Math.round((newSubtotal + newVat) * 100) / 100;
        const updatedNotes = existing.notes ? `${existing.notes}\n${notes}` : notes;

        await supabase.from('invoices').update({
          subtotal: newSubtotal, vat_amount: newVat, amount: newTotal, notes: updatedNotes
        }).eq('id', existing.id);

        invoiceId = existing.id;
      } else {
        const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');
        const insertData: Record<string, unknown> = {
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          invoice_month: targetMonth,
          status: 'draft',
          subtotal,
          vat_amount: vatAmount,
          vat_rate: vatRate,
          vat_inclusive: vatInclusive,
          amount: total,
          notes,
        };
        if (group.customerType === 'tenant') {
          insertData.tenant_id = group.customerId;
        } else {
          insertData.external_customer_id = group.customerId;
        }

        const { data: newInvoice } = await supabase.from('invoices').insert(insertData).select('id').single();
        if (!newInvoice) continue;
        invoiceId = newInvoice.id;
      }

      const bookingIds = group.bookings.map(b => b.id);
      await supabase.from('meeting_room_bookings').update({ invoice_id: invoiceId }).in('id', bookingIds);
    }

    await advanceJobToNextMonth(job);
  } catch (error) {
    console.error('Error generating meeting room invoices:', error);
  }
};

const generateFlexInvoices = async (job: ScheduledJob) => {
  try {
    const prevMonth = new Date();
    prevMonth.setDate(1);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const targetMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    const { data: rates } = await supabase
      .from('space_type_rates')
      .select('vat_inclusive')
      .eq('space_type', 'flexplek')
      .maybeSingle();
    const vatInclusive = rates?.vat_inclusive ?? false;
    const defaultVatRate = 21;

    const { data: bookings } = await supabase
      .from('flex_day_bookings')
      .select('*, office_spaces(space_number)')
      .is('invoice_id', null)
      .in('status', ['confirmed', 'completed'])
      .gte('booking_date', `${targetMonth}-01`)
      .lte('booking_date', `${targetMonth}-31`);

    if (!bookings || bookings.length === 0) {
      await advanceJobToNextMonth(job);
      return;
    }

    const grouped: Record<string, { customerId: string; bookings: typeof bookings }> = {};

    for (const b of bookings) {
      if (!b.external_customer_id) continue;
      const key = `external_${b.external_customer_id}`;
      if (!grouped[key]) {
        grouped[key] = { customerId: b.external_customer_id, bookings: [] };
      }
      grouped[key].bookings.push(b);
    }

    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const group of Object.values(grouped)) {
      const totalAmount = group.bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
      const { subtotal, vatAmount, total } = calculateVAT(totalAmount, defaultVatRate, vatInclusive);

      const notesLines = group.bookings.map(b => {
        const spaceName = b.office_spaces?.space_number || 'Flexplek';
        const dateStr = new Date(b.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const isHalfDay = b.is_half_day;
        const type = isHalfDay ? (b.half_day_period === 'morning' ? 'ochtend' : 'middag') : 'hele dag';
        const amount = Number(b.total_amount);
        return `- ${spaceName} ${dateStr} (${type}) = €${amount.toFixed(2)}`;
      });
      const notes = `Flexwerkplek boekingen:\n${notesLines.join('\n')}`;

      const existingResult = await supabase
        .from('invoices')
        .select('id, subtotal, vat_amount, amount, notes')
        .eq('invoice_month', targetMonth)
        .eq('status', 'draft')
        .eq('external_customer_id', group.customerId)
        .maybeSingle();

      let invoiceId: string;

      if (existingResult.data) {
        const existing = existingResult.data;
        const newSubtotal = Math.round((Number(existing.subtotal) + subtotal) * 100) / 100;
        const newVat = Math.round((newSubtotal * defaultVatRate / 100) * 100) / 100;
        const newTotal = Math.round((newSubtotal + newVat) * 100) / 100;
        const updatedNotes = existing.notes ? `${existing.notes}\n${notes}` : notes;

        await supabase.from('invoices').update({
          subtotal: newSubtotal, vat_amount: newVat, amount: newTotal, notes: updatedNotes
        }).eq('id', existing.id);

        invoiceId = existing.id;
      } else {
        const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');
        const { data: newInvoice } = await supabase.from('invoices').insert({
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          invoice_month: targetMonth,
          status: 'draft',
          subtotal,
          vat_amount: vatAmount,
          vat_rate: defaultVatRate,
          vat_inclusive: vatInclusive,
          amount: total,
          notes,
          external_customer_id: group.customerId,
        }).select('id').single();
        if (!newInvoice) continue;
        invoiceId = newInvoice.id;
      }

      const bookingIds = group.bookings.map(b => b.id);
      await supabase.from('flex_day_bookings').update({ invoice_id: invoiceId }).in('id', bookingIds);
    }

    await advanceJobToNextMonth(job);
  } catch (error) {
    console.error('Error generating flex invoices:', error);
  }
};

const generateMonthlyInvoices = async (job: ScheduledJob) => {
  try {
    const { data: leases } = await supabase
      .from('leases')
      .select(`
        *,
        tenant:tenants(*),
        lease_spaces(
          *,
          space:office_spaces(*)
        )
      `)
      .eq('status', 'active');

    if (!leases || leases.length === 0) return;

    const invoiceMonth = new Date().toISOString().slice(0, 7);
    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const lease of leases) {
      const existingInvoice = await supabase
        .from('invoices')
        .select('id')
        .eq('lease_id', lease.id)
        .eq('invoice_month', invoiceMonth)
        .maybeSingle();

      if (existingInvoice.data) continue;

      const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');

      let baseAmount = 0;
      if ((lease as any).lease_type === 'flex') {
        const flexLease = lease as any;
        if (flexLease.credits_per_week && flexLease.flex_credit_rate) {
          const weeksPerMonth = 4.33;
          baseAmount = Math.round((flexLease.credits_per_week * flexLease.flex_credit_rate * weeksPerMonth) * 100) / 100;
        }
      } else {
        baseAmount = Math.round(lease.lease_spaces.reduce((sum: number, ls: any) => sum + ls.monthly_rent, 0) * 100) / 100;
      }

      baseAmount = Math.round((baseAmount + (lease.security_deposit || 0)) * 100) / 100;

      const { subtotal, vatAmount, total } = calculateVAT(baseAmount, lease.vat_rate, lease.vat_inclusive);

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          lease_id: lease.id,
          tenant_id: lease.tenant_id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          invoice_month: invoiceMonth,
          subtotal: subtotal,
          vat_amount: vatAmount,
          amount: total,
          vat_rate: lease.vat_rate,
          vat_inclusive: lease.vat_inclusive,
          status: 'draft',
          notes: null
        })
        .select()
        .single();

      if (invoiceError || !newInvoice) continue;

      const lineItemsToInsert = [];

      if ((lease as any).lease_type === 'flex') {
        const flexLease = lease as any;
        if (flexLease.credits_per_week && flexLease.flex_credit_rate) {
          const weeksPerMonth = 4.33;
          const monthlyAmount = Math.round((flexLease.credits_per_week * flexLease.flex_credit_rate * weeksPerMonth) * 100) / 100;

          lineItemsToInsert.push({
            invoice_id: newInvoice.id,
            description: `Flexwerkplek - ${flexLease.credits_per_week} ${flexLease.flex_day_type === 'half_day' ? 'halve dagen' : 'dagen'}/week`,
            quantity: flexLease.credits_per_week,
            unit_price: Math.round((flexLease.flex_credit_rate * weeksPerMonth) * 100) / 100,
            amount: monthlyAmount,
            local_category: 'flexplek'
          });
        }
      } else {
        for (const ls of lease.lease_spaces) {
          const spaceName = ls.space.space_number;
          const spaceType = ls.space.space_type;

          let displayName = spaceName;
          if (spaceType === 'bedrijfsruimte') {
            const numOnly = spaceName.replace(/^(Bedrijfsruimte|Hal)\s*/i, '').trim();
            if (/^\d+/.test(numOnly)) {
              displayName = `Hal ${numOnly}`;
            }
          }

          const sqm = ls.space.square_footage || 1;
          const pricePerSqm = sqm > 0 ? Math.round((ls.monthly_rent / sqm) * 100) / 100 : ls.monthly_rent;

          lineItemsToInsert.push({
            invoice_id: newInvoice.id,
            description: displayName,
            quantity: sqm,
            unit_price: pricePerSqm,
            amount: ls.monthly_rent,
            local_category: getLocalCategory(spaceType)
          });
        }
      }

      if (lease.security_deposit > 0) {
        lineItemsToInsert.push({
          invoice_id: newInvoice.id,
          description: 'Voorschot Gas, Water & Electra',
          quantity: 1,
          unit_price: lease.security_deposit,
          amount: lease.security_deposit,
          local_category: 'diversen'
        });
      }

      await supabase.from('invoice_line_items').insert(lineItemsToInsert);
    }

    await advanceJobToNextMonth(job);

  } catch (error) {
    console.error('Error generating monthly invoices:', error);
  }
};
