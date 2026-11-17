import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { amsterdamCalendar } from '../utils/amsterdamCalendar';
import { shiftYearMonth } from '../utils/leaseInvoiceEligibility';
import { missingRentForPastMonths, type RentLease } from '../utils/leaseRentDraft';
import { meetingBookingCharge } from '../utils/meetingInvoiceDraft';

export type UnbilledItem = {
  type: 'huur' | 'vergaderruimte';
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
    const currentMonth = amsterdamCalendar().yearMonth;
    const currentMonthStart = `${currentMonth}-01`;
    const pastMonths: string[] = [];
    for (let offset = -6; offset < 0; offset += 1) pastMonths.push(shiftYearMonth(currentMonth, offset));

    const [
      { data: activeLeases },
      { data: allInvoices },
      { data: unbilledMeetings }
    ] = await Promise.all([
      supabase.from('leases').select(`
        id, tenant_id, security_deposit, start_date, end_date, vat_rate, vat_inclusive,
        lease_spaces:lease_spaces(
          price_per_sqm, monthly_rent,
          space:office_spaces(space_number, space_type, square_footage, rate_per_sqm, diversen_calculation)
        ),
        tenants(company_name, lease_discount_percentage)
      `).eq('status', 'active'),
      supabase.from('invoices').select('lease_id, invoice_month, notes'),
      supabase.from('meeting_room_bookings').select(`
        id, booking_date, total_amount, discount_amount, vat_rate, tenant_id, external_customer_id,
        tenants(company_name, vat_rate, meeting_discount_percentage),
        external_customers(company_name, vat_rate, meeting_discount_percentage)
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
      for (const lease of activeLeases) {
        const tenantRow = Array.isArray((lease as any).tenants) ? (lease as any).tenants[0] : (lease as any).tenants;
        const customerName = tenantRow?.company_name || 'Onbekende huurder';
        const rentLease: RentLease = {
          id: lease.id,
          start_date: lease.start_date,
          end_date: lease.end_date,
          vat_rate: lease.vat_rate,
          vat_inclusive: lease.vat_inclusive,
          security_deposit: lease.security_deposit,
          tenant: tenantRow ? { lease_discount_percentage: tenantRow.lease_discount_percentage } : null,
          lease_spaces: (lease.lease_spaces || []).map((entry) => ({
            price_per_sqm: entry.price_per_sqm,
            monthly_rent: entry.monthly_rent,
            space: Array.isArray(entry.space) ? entry.space[0] : entry.space,
          })),
        };
        const leaseInvoices = (allInvoices || []).filter((inv) => inv.lease_id === lease.id);
        for (const missing of missingRentForPastMonths(rentLease, leaseInvoices, pastMonths)) {
          allItems.push({
            type: 'huur',
            month: missing.month,
            monthLabel: getMonthLabel(missing.month),
            customerName,
            amount: missing.amount,
          });
        }
      }
    }

    (unbilledMeetings || []).forEach((b: any) => {
      const month = b.booking_date.substring(0, 7);
      if (month >= currentMonth) return;
      const tenantRow = Array.isArray(b.tenants) ? b.tenants[0] : b.tenants;
      const externalRow = Array.isArray(b.external_customers) ? b.external_customers[0] : b.external_customers;
      const profile = b.tenant_id ? tenantRow : externalRow;
      const name = b.tenant_id
        ? (tenantRow?.company_name || 'Onbekende huurder')
        : (externalRow?.company_name || 'Externe klant');
      allItems.push({
        type: 'vergaderruimte',
        month,
        monthLabel: getMonthLabel(month),
        customerName: name,
        amount: meetingBookingCharge(b, Number(profile?.vat_rate ?? 21), Number(profile?.meeting_discount_percentage) || 0),
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
