import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type UnbilledItem = {
  type: 'huur' | 'vergaderruimte' | 'flexplek';
  month: string;
  monthLabel: string;
  customerName: string;
  amount: number;
};

export type UnbilledGroup = {
  month: string;
  monthLabel: string;
  items: UnbilledItem[];
  totalAmount: number;
};

export function useUnbilledItems() {
  const [totalItems, setTotalItems] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [groups, setGroups] = useState<UnbilledGroup[]>([]);
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
        id, lease_type, tenant_id,
        flex_pricing_model, flex_monthly_rate, flex_daily_rate, flex_credit_rate, credits_per_week,
        security_deposit, start_date,
        lease_spaces:lease_spaces(monthly_rent),
        tenants(company_name)
      `).eq('status', 'active'),
      supabase.from('invoices').select('lease_id, invoice_month'),
      supabase.from('meeting_room_bookings').select(`
        id, booking_date, total_amount, tenant_id, external_customer_id,
        tenants(company_name), external_customers(company_name)
      `)
        .lt('booking_date', currentMonthStart)
        .in('status', ['confirmed', 'completed'])
        .is('invoice_id', null),
      supabase.from('flex_day_bookings').select(`
        id, booking_date, total_amount, external_customer_id,
        external_customers(company_name)
      `)
        .lt('booking_date', currentMonthStart)
        .in('status', ['confirmed', 'completed'])
        .is('invoice_id', null)
    ]);

    const allItems: UnbilledItem[] = [];

    const getMonthLabel = (month: string) => {
      const [y, m] = month.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
    };

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
        const customerName = (lease as any).tenants?.company_name || 'Onbekende huurder';

        const leaseEnd = (lease as any).end_date?.substring(0, 7);
        for (const month of pastMonths) {
          if (month < leaseStart) continue;
          if (leaseEnd && month > leaseEnd) continue;
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

          allItems.push({
            type: 'huur',
            month,
            monthLabel: getMonthLabel(month),
            customerName,
            amount: amt
          });
        }
      }
    }

    (unbilledMeetings || []).forEach((b: any) => {
      const month = b.booking_date.substring(0, 7);
      if (month >= currentMonth) return;
      const name = b.tenant_id
        ? (b.tenants?.company_name || 'Onbekende huurder')
        : (b.external_customers?.company_name || 'Externe klant');
      allItems.push({
        type: 'vergaderruimte',
        month,
        monthLabel: getMonthLabel(month),
        customerName: name,
        amount: b.total_amount || 0
      });
    });

    (unbilledFlex || []).forEach((b: any) => {
      const month = b.booking_date.substring(0, 7);
      if (month >= currentMonth) return;
      allItems.push({
        type: 'flexplek',
        month,
        monthLabel: getMonthLabel(month),
        customerName: b.external_customers?.company_name || 'Externe klant',
        amount: b.total_amount || 0
      });
    });

    const groupMap = new Map<string, UnbilledGroup>();
    for (const item of allItems) {
      if (!groupMap.has(item.month)) {
        groupMap.set(item.month, {
          month: item.month,
          monthLabel: item.monthLabel,
          items: [],
          totalAmount: 0
        });
      }
      const g = groupMap.get(item.month)!;
      g.items.push(item);
      g.totalAmount += item.amount;
    }

    const sorted = Array.from(groupMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    setTotalItems(allItems.length);
    setTotalAmount(allItems.reduce((s, i) => s + i.amount, 0));
    setGroups(sorted);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { totalItems, totalAmount, groups, loading };
}
