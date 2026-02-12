import { supabase } from '../lib/supabase';

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

      const calculateVAT = (baseAmount: number, vatRate: number, vatInclusive: boolean) => {
        if (vatInclusive) {
          const total = Math.round(baseAmount * 100) / 100;
          const subtotal = Math.round((baseAmount / (1 + (vatRate / 100))) * 100) / 100;
          const vatAmount = Math.round((baseAmount - subtotal) * 100) / 100;
          return { subtotal, vatAmount, total };
        } else {
          const subtotal = Math.round(baseAmount * 100) / 100;
          const vatAmount = Math.round((baseAmount * (vatRate / 100)) * 100) / 100;
          const total = Math.round((baseAmount + vatAmount) * 100) / 100;
          return { subtotal, vatAmount, total };
        }
      };

      const { subtotal, vatAmount, total } = calculateVAT(
        baseAmount,
        lease.vat_rate,
        lease.vat_inclusive
      );

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
          const dayType = flexLease.flex_day_type === 'half_day' ? 'halve dag' : 'dag';

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
