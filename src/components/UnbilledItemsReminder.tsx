import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Home, Calendar, Zap, ChevronDown, ChevronUp, ArrowRight, RefreshCw } from 'lucide-react';

type UnbilledGroup = {
  month: string;
  monthLabel: string;
  leases: {
    id: string;
    tenantName: string;
    amount: number;
  }[];
  meetingBookings: {
    id: string;
    customerName: string;
    isExternal: boolean;
    bookingDate: string;
    spaceName: string;
    amount: number;
  }[];
  flexBookings: {
    id: string;
    customerName: string;
    isExternal: boolean;
    bookingDate: string;
    spaceName: string;
    amount: number;
  }[];
};

type UnbilledItemsReminderProps = {
  onNavigateToInvoicing?: (month: string) => void;
};

export function UnbilledItemsReminder({ onNavigateToInvoicing }: UnbilledItemsReminderProps) {
  const [groups, setGroups] = useState<UnbilledGroup[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
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
      { data: unbilledFlex },
      { data: tenants },
      { data: externals }
    ] = await Promise.all([
      supabase.from('leases').select(`
        id, tenant_id, lease_type, vat_rate, vat_inclusive,
        flex_pricing_model, flex_monthly_rate, flex_daily_rate, flex_credit_rate, credits_per_week,
        security_deposit, start_date,
        tenant:tenants(company_name, name),
        lease_spaces:lease_spaces(monthly_rent)
      `).eq('status', 'active'),
      supabase.from('invoices').select('lease_id, invoice_month'),
      supabase.from('meeting_room_bookings').select(`
        id, booking_date, total_amount, tenant_id, external_customer_id, status,
        office_spaces(space_number)
      `).lt('booking_date', currentMonthStart)
        .in('status', ['confirmed', 'completed'])
        .is('invoice_id', null),
      supabase.from('flex_day_bookings').select(`
        id, booking_date, total_amount, external_customer_id, status,
        leases(tenant_id),
        office_spaces(space_number)
      `).lt('booking_date', currentMonthStart)
        .in('status', ['confirmed', 'completed'])
        .is('invoice_id', null),
      supabase.from('tenants').select('id, company_name, name'),
      supabase.from('external_customers').select('id, company_name, contact_name')
    ]);

    const tenantMap = new Map<string, string>();
    (tenants || []).forEach((t: any) => tenantMap.set(t.id, t.company_name || t.name));

    const externalMap = new Map<string, string>();
    (externals || []).forEach((e: any) => externalMap.set(e.id, e.company_name || e.contact_name));

    const monthsMap = new Map<string, UnbilledGroup>();

    const getOrCreateGroup = (month: string): UnbilledGroup => {
      if (!monthsMap.has(month)) {
        const [y, m] = month.split('-').map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
        monthsMap.set(month, {
          month,
          monthLabel: label,
          leases: [],
          meetingBookings: [],
          flexBookings: []
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

          const tenant = (lease as any).tenant;
          const name = tenant?.company_name || tenant?.name || 'Onbekend';
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
          group.leases.push({ id: lease.id, tenantName: name, amount });
        }
      }
    }

    (unbilledMeetings || []).forEach((b: any) => {
      const month = b.booking_date.substring(0, 7);
      if (month >= currentMonth) return;
      const group = getOrCreateGroup(month);
      const customerName = b.tenant_id
        ? (tenantMap.get(b.tenant_id) || 'Onbekende huurder')
        : (externalMap.get(b.external_customer_id) || 'Onbekende klant');
      group.meetingBookings.push({
        id: b.id,
        customerName,
        isExternal: !b.tenant_id,
        bookingDate: b.booking_date,
        spaceName: b.office_spaces?.space_number || 'Vergaderruimte',
        amount: b.total_amount || 0
      });
    });

    (unbilledFlex || []).forEach((b: any) => {
      const month = b.booking_date.substring(0, 7);
      if (month >= currentMonth) return;
      const group = getOrCreateGroup(month);
      const tenantId = (b.leases as any)?.tenant_id;
      const customerName = tenantId
        ? (tenantMap.get(tenantId) || 'Onbekende huurder')
        : (externalMap.get(b.external_customer_id) || 'Onbekende klant');
      group.flexBookings.push({
        id: b.id,
        customerName,
        isExternal: !tenantId,
        bookingDate: b.booking_date,
        spaceName: b.office_spaces?.space_number || 'Flexplek',
        amount: b.total_amount || 0
      });
    });

    const sorted = Array.from(monthsMap.values())
      .filter(g => g.leases.length > 0 || g.meetingBookings.length > 0 || g.flexBookings.length > 0)
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

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  if (loading) return null;
  if (groups.length === 0) return null;

  const totalLeases = groups.reduce((sum, g) => sum + g.leases.length, 0);
  const totalMeetings = groups.reduce((sum, g) => sum + g.meetingBookings.length, 0);
  const totalFlex = groups.reduce((sum, g) => sum + g.flexBookings.length, 0);
  const totalItems = totalLeases + totalMeetings + totalFlex;
  const totalAmount = groups.reduce((sum, g) => {
    const leaseAmt = g.leases.reduce((s, l) => s + l.amount, 0);
    const meetingAmt = g.meetingBookings.reduce((s, b) => s + b.amount, 0);
    const flexAmt = g.flexBookings.reduce((s, b) => s + b.amount, 0);
    return sum + leaseAmt + meetingAmt + flexAmt;
  }, 0);

  return (
    <div className="bg-dark-900 rounded-lg shadow-sm border border-amber-800/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-900/30 rounded-lg">
            <AlertTriangle className="text-amber-400" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Ongefactureerde Items</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalItems} item{totalItems !== 1 ? 's' : ''} uit voorgaande maanden
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-amber-400">
            {'\u20AC'}{totalAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
            title="Vernieuwen"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="px-6 py-3 flex items-center gap-4 border-b border-dark-700/50 bg-dark-800/30">
        {totalLeases > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Home size={13} className="text-emerald-400" />
            <span>{totalLeases} huur/flex contract{totalLeases !== 1 ? 'en' : ''}</span>
          </div>
        )}
        {totalMeetings > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar size={13} className="text-blue-400" />
            <span>{totalMeetings} vergaderruimte boeking{totalMeetings !== 1 ? 'en' : ''}</span>
          </div>
        )}
        {totalFlex > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Zap size={13} className="text-teal-400" />
            <span>{totalFlex} flex boeking{totalFlex !== 1 ? 'en' : ''}</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-dark-700/50">
        {groups.map(group => {
          const isExpanded = expandedMonths.has(group.month);
          const groupTotal = group.leases.reduce((s, l) => s + l.amount, 0)
            + group.meetingBookings.reduce((s, b) => s + b.amount, 0)
            + group.flexBookings.reduce((s, b) => s + b.amount, 0);
          const itemCount = group.leases.length + group.meetingBookings.length + group.flexBookings.length;

          return (
            <div key={group.month}>
              <button
                onClick={() => toggleMonth(group.month)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-dark-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded
                    ? <ChevronUp size={16} className="text-gray-500" />
                    : <ChevronDown size={16} className="text-gray-500" />}
                  <span className="font-medium text-gray-200 capitalize">{group.monthLabel}</span>
                  <span className="text-xs text-gray-500 bg-dark-700 px-2 py-0.5 rounded-full">
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-amber-400">
                    {'\u20AC'}{groupTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {onNavigateToInvoicing && (
                    <span
                      onClick={(e) => { e.stopPropagation(); onNavigateToInvoicing(group.month); }}
                      className="text-xs text-gold-500 hover:text-gold-400 flex items-center gap-1 transition-colors"
                    >
                      Factureren <ArrowRight size={12} />
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-4 space-y-3">
                  {group.leases.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Home size={14} className="text-emerald-400" />
                        <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Huur & Flex contracten</span>
                      </div>
                      <div className="space-y-1">
                        {group.leases.map((lease, idx) => (
                          <div key={`${lease.id}-${idx}`} className="flex items-center justify-between py-1.5 px-3 rounded bg-dark-800/50 text-sm">
                            <span className="text-gray-300">{lease.tenantName}</span>
                            <span className="text-gray-400 font-medium">
                              {'\u20AC'}{lease.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {group.meetingBookings.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar size={14} className="text-blue-400" />
                        <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Vergaderruimte boekingen</span>
                      </div>
                      <div className="space-y-1">
                        {group.meetingBookings.map(booking => (
                          <div key={booking.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-dark-800/50 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-300">{booking.customerName}</span>
                              {booking.isExternal && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-dark-700 text-gray-500 border border-dark-600">Extern</span>
                              )}
                              <span className="text-xs text-gray-500">
                                {booking.spaceName} - {new Date(booking.bookingDate + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' })}
                              </span>
                            </div>
                            <span className="text-gray-400 font-medium">
                              {'\u20AC'}{booking.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {group.flexBookings.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Zap size={14} className="text-teal-400" />
                        <span className="text-xs font-medium text-teal-400 uppercase tracking-wider">Flex boekingen</span>
                      </div>
                      <div className="space-y-1">
                        {group.flexBookings.map(booking => (
                          <div key={booking.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-dark-800/50 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-300">{booking.customerName}</span>
                              {booking.isExternal && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-dark-700 text-gray-500 border border-dark-600">Extern</span>
                              )}
                              <span className="text-xs text-gray-500">
                                {booking.spaceName} - {new Date(booking.bookingDate + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' })}
                              </span>
                            </div>
                            <span className="text-gray-400 font-medium">
                              {'\u20AC'}{booking.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
