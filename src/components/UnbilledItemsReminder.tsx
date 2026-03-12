import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useUnbilledItems() {
  const [totalItems, setTotalItems] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthStart = `${currentMonth}-01`;

    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const lookbackStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

    const [
      { data: activeLeases },
      { data: allInvoices },
      { data: unbilledMeetings },
      { data: unbilledFlex }
    ] = await Promise.all([
      supabase.from('leases').select(`
        id, lease_type,
        flex_pricing_model, flex_monthly_rate, flex_daily_rate, flex_credit_rate, credits_per_week,
        security_deposit, start_date,
        lease_spaces:lease_spaces(monthly_rent)
      `).eq('status', 'active'),
      supabase.from('invoices').select('lease_id, invoice_month'),
      supabase.from('meeting_room_bookings').select('id, booking_date, total_amount')
        .lt('booking_date', currentMonthStart)
        .in('status', ['confirmed', 'completed'])
        .is('invoice_id', null),
      supabase.from('flex_day_bookings').select('id, booking_date, total_amount')
        .lt('booking_date', currentMonthStart)
        .in('status', ['confirmed', 'completed'])
        .is('invoice_id', null)
    ]);

    let items = 0;
    let amount = 0;

    if (activeLeases) {
      const pastMonths: string[] = [];
      const d = new Date(sixMonthsAgo);
      while (d < now) {
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (m < currentMonth) pastMonths.push(m);
        d.setMonth(d.getMonth() + 1);
      }

      for (const lease of activeLeases) {
        const leaseStart = (lease as any).start_date?.substring(0, 7) || lookbackStart;

        for (const month of pastMonths) {
          if (month < leaseStart) continue;
          const alreadyInvoiced = (allInvoices || []).some(
            (inv: any) => inv.lease_id === lease.id && inv.invoice_month === month
          );
          if (alreadyInvoiced) continue;

          let amt = 0;
          if (lease.lease_type === 'flex') {
            if (lease.flex_pricing_model === 'monthly_unlimited') {
              amt = lease.flex_monthly_rate || 0;
            } else if (lease.flex_pricing_model === 'daily') {
              const [y, m] = month.split('-').map(Number);
              const workingDays = Math.round(new Date(y, m, 0).getDate() * (5 / 7));
              amt = (lease.flex_daily_rate || 0) * workingDays;
            } else if (lease.flex_pricing_model === 'credit_based') {
              const monthlyCredits = Math.round((lease.credits_per_week || 0) * 4.33);
              amt = monthlyCredits * (lease.flex_credit_rate || 0);
            }
          } else {
            amt = ((lease as any).lease_spaces || []).reduce((sum: number, ls: any) => {
              const rent = typeof ls.monthly_rent === 'string' ? parseFloat(ls.monthly_rent) : ls.monthly_rent;
              return sum + rent;
            }, 0);
            const deposit = typeof lease.security_deposit === 'string' ? parseFloat(lease.security_deposit as any) : lease.security_deposit;
            amt += deposit || 0;
          }

          items++;
          amount += amt;
        }
      }
    }

    (unbilledMeetings || []).forEach((b: any) => {
      const month = b.booking_date.substring(0, 7);
      if (month >= currentMonth) return;
      items++;
      amount += b.total_amount || 0;
    });

    (unbilledFlex || []).forEach((b: any) => {
      const month = b.booking_date.substring(0, 7);
      if (month >= currentMonth) return;
      items++;
      amount += b.total_amount || 0;
    });

    setTotalItems(items);
    setTotalAmount(amount);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { totalItems, totalAmount, loading };
}
