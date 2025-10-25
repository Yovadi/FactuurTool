import { supabase } from '../lib/supabase';

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
    }
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

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          lease_id: lease.id,
          tenant_id: lease.tenant_id,
          invoice_date: invoiceDate,
          due_date: dueDate,
          invoice_month: invoiceMonth,
          vat_rate: lease.vat_rate,
          vat_inclusive: lease.vat_inclusive,
          status: 'concept',
          notes: ''
        })
        .select()
        .single();

      if (invoiceError || !newInvoice) continue;

      const lineItemsToInsert = [];

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

        lineItemsToInsert.push({
          invoice_id: newInvoice.id,
          description: displayName,
          quantity: ls.space.square_footage || 1,
          unit_price: ls.monthly_rent,
          amount: ls.monthly_rent
        });
      }

      if (lease.security_deposit > 0) {
        lineItemsToInsert.push({
          invoice_id: newInvoice.id,
          description: 'Voorschot Gas, Water & Electra',
          quantity: 1,
          unit_price: lease.security_deposit,
          amount: lease.security_deposit
        });
      }

      await supabase
        .from('invoice_line_items')
        .insert(lineItemsToInsert);
    }

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);

    await supabase
      .from('scheduled_jobs')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextMonth.toISOString()
      })
      .eq('id', job.id);

  } catch (error) {
    console.error('Error generating monthly invoices:', error);
  }
};
