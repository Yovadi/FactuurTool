import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Home, Calendar, Zap, ChevronDown, ChevronUp, ArrowRight, RefreshCw } from 'lucide-react';

type UnbilledGroup = {
  month: string;
  monthLabel: string;
  leaseCount: number;
  leaseAmount: number;
  meetingCount: number;
  meetingAmount: number;
  flexCount: number;
  flexAmount: number;
};

type UnbilledItemsReminderProps = {
  onNavigateToInvoicing?: (month: string) => void;
};

export function UnbilledItemsReminder({ onNavigateToInvoicing }: UnbilledItemsReminderProps) {
  const [groups, setGroups] = useState<UnbilledGroup[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUnbilledItems = useCallback(async () => {
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
        id, tenant_id, lease_type, vat_rate, vat_inclusive,
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

    const monthsMap = new Map<string, UnbilledGroup>();

    const getOrCreateGroup = (month: string): UnbilledGroup => {
      if (!monthsMap.has(month)) {
        const [y, m] = month.split('-').map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
        monthsMap.set(month, {
          month, monthLabel: label,
          leaseCount: 0, leaseAmount: 0,
          meetingCount: 0, meetingAmount: 0,
          flexCount: 0, flexAmount: 0
        });
      }
      return monthsMap.get(month)!;
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

        for (const month of pastMonths) {
          if (month < leaseStart) continue;

          const alreadyInvoiced = (allInvoices || []).some(
            (inv: any) => inv.lease_id === lease.id && inv.invoice_month === month
          );
          if (alreadyInvoiced) continue;

          let amount = 0;
          if (lease.lease_type === 'flex') {
            if (lease.flex_pricing_model === 'monthly_unlimited') {
              amount = lease.flex_monthly_rate || 0;
            } else if (lease.flex_pricing_model === 'daily') {
              const [y, m] = month.split('-').map(Number);
              const workingDays = Math.round(new Date(y, m, 0).getDate() * (5 / 7));
              amount = (lease.flex_daily_rate || 0) * workingDays;
            } else if (lease.flex_pricing_model === 'credit_based') {
              const monthlyCredits = Math.round((lease.credits_per_week || 0) * 4.33);
              amount = monthlyCredits * (lease.flex_credit_rate || 0);
            }
          } else {
            amount = ((lease as any).lease_spaces || []).reduce((sum: number, ls: any) => {
              const rent = typeof ls.monthly_rent === 'string' ? parseFloat(ls.monthly_rent) : ls.monthly_rent;
              return sum + rent;
            }, 0);
            const deposit = typeof lease.security_deposit === 'string' ? parseFloat(lease.security_deposit as any) : lease.security_deposit;
            amount += deposit || 0;
          }

          const group = getOrCreateGroup(month);
          group.leaseCount++;
          group.leaseAmount += amount;
        }
      }
    }

    (unbilledMeetings || []).forEach((b: any) => {
      const month = b.booking_date.substring(0, 7);
      if (month >= currentMonth) return;
      const group = getOrCreateGroup(month);
      group.meetingCount++;
      group.meetingAmount += b.total_amount || 0;
    });

    (unbilledFlex || []).forEach((b: any) => {
      const month = b.booking_date.substring(0, 7);
      if (month >= currentMonth) return;
      const group = getOrCreateGroup(month);
      group.flexCount++;
      group.flexAmount += b.total_amount || 0;
    });

    const sorted = Array.from(monthsMap.values())
      .filter(g => g.leaseCount > 0 || g.meetingCount > 0 || g.flexCount > 0)
      .sort((a, b) => a.month.localeCompare(b.month));

    setGroups(sorted);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadUnbilledItems();
  }, [loadUnbilledItems]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUnbilledItems();
  };

  if (loading) return null;
  if (groups.length === 0) return null;

  const totalItems = groups.reduce((s, g) => s + g.leaseCount + g.meetingCount + g.flexCount, 0);
  const totalAmount = groups.reduce((s, g) => s + g.leaseAmount + g.meetingAmount + g.flexAmount, 0);

  const fmt = (n: number) => '\u20AC' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-amber-900/15 rounded-lg border border-amber-800/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-900/10 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="text-amber-400 flex-shrink-0" size={18} />
          <span className="font-medium text-amber-200 text-sm">
            {totalItems} ongefactureerd{totalItems !== 1 ? 'e' : ''} item{totalItems !== 1 ? 's' : ''} uit voorgaande maanden
          </span>
          <span className="text-sm font-semibold text-amber-400">{fmt(totalAmount)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            disabled={refreshing}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            title="Vernieuwen"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-amber-800/30">
          {groups.map(group => {
            const groupTotal = group.leaseAmount + group.meetingAmount + group.flexAmount;

            return (
              <div key={group.month} className="px-4 py-2.5 flex items-center justify-between border-b border-dark-700/30 last:border-b-0 hover:bg-dark-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-200 capitalize w-36">{group.monthLabel}</span>
                  <div className="flex items-center gap-2.5">
                    {group.leaseCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Home size={12} className="text-emerald-400" />{group.leaseCount}
                      </span>
                    )}
                    {group.meetingCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar size={12} className="text-blue-400" />{group.meetingCount}
                      </span>
                    )}
                    {group.flexCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Zap size={12} className="text-teal-400" />{group.flexCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-amber-400 font-medium">{fmt(groupTotal)}</span>
                  {onNavigateToInvoicing && (
                    <button
                      onClick={() => onNavigateToInvoicing(group.month)}
                      className="text-xs text-gold-500 hover:text-gold-400 flex items-center gap-0.5 transition-colors"
                    >
                      Factureren <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
