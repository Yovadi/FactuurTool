import { useState, useEffect, useCallback } from 'react';
import { supabase, type Tenant, type ExternalCustomer, type Lease, type LeaseSpace, type OfficeSpace } from '../lib/supabase';
import { Home, Calendar, CheckSquare, Square, Loader2, AlertTriangle, ChevronDown, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import { Toast } from './Toast';

type LeaseWithDetails = Lease & {
  tenant: Tenant;
  lease_spaces: (LeaseSpace & { space: OfficeSpace })[];
};

type InvoiceItem = {
  id: string;
  type: 'huur' | 'meeting_booking';
  customerId: string;
  customerName: string;
  isExternal: boolean;
  leaseId?: string;
  description: string;
  amount: number;
  vatRate: number;
  vatInclusive: boolean;
  bookings?: any[];
  lease?: LeaseWithDetails;
  details: string[];
  customerDiscountPct?: number;
};

function getLocalCategory(spaceType?: string, bookingType?: string): string | null {
  if (bookingType === 'meeting_room') return 'vergaderruimte';
  switch (spaceType) {
    case 'kantoor': return 'huur_kantoor';
    case 'bedrijfsruimte': return 'huur_bedrijfsruimte';
    case 'buitenterrein': return 'huur_buitenterrein';
    case 'diversen': return 'diversen';
    default: return null;
  }
}

function calculateVAT(baseAmount: number, vatRate: number, vatInclusive: boolean) {
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
}

type InvoiceOverviewProps = {
  onInvoicesCreated?: () => void;
};

export function InvoiceOverview({ onInvoicesCreated }: InvoiceOverviewProps = {}) {
  const [invoiceMonth, setInvoiceMonth] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [pastDueBookings, setPastDueBookings] = useState<{ meetingCount: number; months: string[] }>({ meetingCount: 0, months: [] });
  const [monthIndicators, setMonthIndicators] = useState<Record<string, { hasLeases: boolean; hasBookings: boolean; count: number }>>({});
  const [visibleMonths, setVisibleMonths] = useState<string[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getMonthRange = (centerMonth: string) => {
    const [cy, cm] = centerMonth.split('-').map(Number);
    const months: string[] = [];
    for (let offset = -1; offset <= 1; offset++) {
      const d = new Date(cy, cm - 1 + offset, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  };

  const loadMonthIndicators = useCallback(async (months: string[]) => {
    const indicators: Record<string, { hasLeases: boolean; hasBookings: boolean; count: number }> = {};

    const [
      { data: activeLeases },
      { data: allInvoices },
      { data: unbilledMeetings },
    ] = await Promise.all([
      supabase.from('leases').select('id, tenant_id, start_date, end_date').eq('status', 'active'),
      supabase.from('invoices').select('lease_id, invoice_month'),
      supabase.from('meeting_room_bookings').select('id, booking_date')
        .in('status', ['confirmed', 'completed']).is('invoice_id', null),
    ]);

    for (const month of months) {
      const [year, m] = month.split('-').map(Number);
      const startDate = `${year}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const endDate = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let leaseCount = 0;
      if (activeLeases && month >= '2026-02') {
        for (const lease of activeLeases as any[]) {
          if (lease.start_date && lease.start_date > endDate) continue;
          if (lease.end_date && lease.end_date < startDate) continue;
          const alreadyInvoiced = (allInvoices || []).some(
            (inv: any) => inv.lease_id === lease.id && inv.invoice_month === month
          );
          if (!alreadyInvoiced) leaseCount++;
        }
      }

      const meetingsInMonth = (unbilledMeetings || []).filter(
        (b: any) => b.booking_date >= startDate && b.booking_date <= endDate
      );
      const bookingCount = meetingsInMonth.length;

      indicators[month] = {
        hasLeases: leaseCount > 0,
        hasBookings: bookingCount > 0,
        count: leaseCount + bookingCount
      };
    }

    setMonthIndicators(indicators);
  }, []);

  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setInvoiceMonth(currentMonth);
    const months = getMonthRange(currentMonth);
    setVisibleMonths(months);
  }, []);

  const loadInvoiceableItems = useCallback(async () => {
    if (!invoiceMonth) return;
    setLoading(true);

    const [year, month] = invoiceMonth.split('-').map(Number);
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [
      { data: leasesData },
      { data: invoicesData },
      { data: tenantsData },
      { data: externalData },
      { data: meetingData },
      { data: pastMeetingData },
    ] = await Promise.all([
      supabase.from('leases').select(`
        *, tenant:tenants(*),
        lease_spaces:lease_spaces(*, space:office_spaces(*))
      `).eq('status', 'active'),
      supabase.from('invoices').select('id, lease_id, tenant_id, external_customer_id, invoice_month, status'),
      supabase.from('tenants').select('*'),
      supabase.from('external_customers').select('*'),
      supabase.from('meeting_room_bookings').select(`
        id, booking_date, start_time, end_time, total_hours, total_amount, hourly_rate,
        discount_percentage, discount_amount, rate_type, applied_rate, status, invoice_id,
        tenant_id, external_customer_id, office_spaces(space_number)
      `).gte('booking_date', startDateStr).lte('booking_date', endDateStr)
        .in('status', ['confirmed', 'completed']).is('invoice_id', null),
      supabase.from('meeting_room_bookings').select('id, booking_date')
        .lt('booking_date', startDateStr)
        .in('status', ['confirmed', 'completed']).is('invoice_id', null),
    ]);

    const allPastDue = [
      ...(pastMeetingData || []).map((b: any) => b.booking_date),
    ];
    const pastMonthsSet = new Set<string>();
    allPastDue.forEach(d => {
      const dt = new Date(d + 'T00:00:00');
      pastMonthsSet.add(dt.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }));
    });
    setPastDueBookings({
      meetingCount: (pastMeetingData || []).length,
      months: Array.from(pastMonthsSet).sort()
    });

    const leases = (leasesData || []) as LeaseWithDetails[];
    const invoices = invoicesData || [];
    const tenants = (tenantsData || []) as Tenant[];
    const externals = (externalData || []) as ExternalCustomer[];
    const meetings = (meetingData || []).map((b: any) => ({ ...b, space: b.office_spaces, booking_type: 'meeting_room' }));

    const newItems: InvoiceItem[] = [];

    for (const lease of leases) {
      if ((lease as any).start_date && (lease as any).start_date > endDateStr) continue;
      if ((lease as any).end_date && (lease as any).end_date < startDateStr) continue;
      const hasExisting = invoices.some(inv => inv.lease_id === lease.id && inv.invoice_month === invoiceMonth);
      if (hasExisting) continue;

      let amount = 0;
      const details: string[] = [];

      amount = lease.lease_spaces.reduce((sum, ls) => {
        const rent = typeof ls.monthly_rent === 'string' ? parseFloat(ls.monthly_rent) : ls.monthly_rent;
        return sum + rent;
      }, 0);
      const deposit = typeof lease.security_deposit === 'string' ? parseFloat(lease.security_deposit) : lease.security_deposit;
      amount += deposit;

      lease.lease_spaces.forEach(ls => {
        let name = ls.space.space_number;
        if (ls.space.space_type === 'bedrijfsruimte') {
          const numOnly = name.replace(/^(Bedrijfsruimte|Hal)\s*/i, '').trim();
          if (/^\d+/.test(numOnly)) name = `Hal ${numOnly}`;
        }
        const rent = typeof ls.monthly_rent === 'string' ? parseFloat(ls.monthly_rent) : ls.monthly_rent;
        details.push(`${name}: ${rent.toFixed(2)}`);
      });
      if (deposit > 0) {
        details.push(`Voorschot GWE: ${deposit.toFixed(2)}`);
      }

      newItems.push({
        id: `huur_${lease.id}`,
        type: 'huur',
        customerId: lease.tenant_id,
        customerName: lease.tenant?.company_name || lease.tenant?.name || 'Onbekend',
        isExternal: false,
        leaseId: lease.id,
        description: `Huurcontract`,
        amount,
        vatRate: lease.vat_rate,
        vatInclusive: lease.vat_inclusive,
        lease,
        details
      });
    }

    const allCustomers = [
      ...tenants.map(t => ({ id: t.id, name: t.company_name || t.name, isExternal: false, discountPct: t.meeting_discount_percentage || 0 })),
      ...externals.map(e => ({ id: e.id, name: e.company_name || e.contact_name, isExternal: true, discountPct: e.meeting_discount_percentage || 0 }))
    ];

    for (const customer of allCustomers) {
      const customerMeetings = meetings.filter((b: any) =>
        customer.isExternal ? b.external_customer_id === customer.id : b.tenant_id === customer.id
      );
      const allBookings = [...customerMeetings];

      if (allBookings.length === 0) continue;

      let totalAmount = 0;
      const details: string[] = [];

      allBookings.forEach((b: any) => {
        totalAmount += b.total_amount || 0;
        const spaceName = b.space?.space_number || 'Vergaderruimte';
        const date = new Date(b.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' });
        const start = b.start_time?.substring(0, 5) || '--:--';
        const end = b.end_time?.substring(0, 5) || '--:--';
        details.push(`${spaceName} - ${date} ${start}-${end}: ${(b.total_amount || 0).toFixed(2)}`);
      });

      const typeLabel = 'Vergaderruimte';

      newItems.push({
        id: `bookings_${customer.id}`,
        type: 'meeting_booking',
        customerId: customer.id,
        customerName: customer.name,
        isExternal: customer.isExternal,
        description: `${typeLabel} boekingen (${allBookings.length}x)`,
        amount: totalAmount,
        vatRate: 21,
        vatInclusive: false,
        bookings: allBookings,
        details,
        customerDiscountPct: customer.discountPct
      });
    }

    newItems.sort((a, b) => {
      const typeOrder = { huur: 0, meeting_booking: 1 };
      if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
      return a.customerName.localeCompare(b.customerName);
    });

    setItems(newItems);
    setSelected(new Set(newItems.map(i => i.id)));
    setLoading(false);
  }, [invoiceMonth]);

  useEffect(() => {
    if (invoiceMonth) loadInvoiceableItems();
  }, [invoiceMonth, loadInvoiceableItems]);

  useEffect(() => {
    if (visibleMonths.length > 0) loadMonthIndicators(visibleMonths);
  }, [visibleMonths, loadMonthIndicators]);

  const selectMonth = (month: string) => {
    setInvoiceMonth(month);
    const months = getMonthRange(month);
    setVisibleMonths(months);
  };

  const shiftMonths = (direction: -1 | 1) => {
    const edgeMonth = visibleMonths[direction === -1 ? 0 : visibleMonths.length - 1];
    const [cy, cm] = edgeMonth.split('-').map(Number);
    const d = new Date(cy, cm - 1 + direction, 1);
    const newCenter = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const months = getMonthRange(newCenter);
    setVisibleMonths(months);
  };

  const toggleItem = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.id)));
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateSelectedInvoices = async () => {
    const selectedItems = items.filter(i => selected.has(i.id));
    if (selectedItems.length === 0) return;

    setGenerating(true);
    let successCount = 0;
    let failCount = 0;

    const { data: settings } = await supabase
      .from('company_settings')
      .select('test_mode, test_date')
      .maybeSingle();

    let currentDate = new Date();
    if (settings?.test_mode === true && settings?.test_date) {
      currentDate = new Date(settings.test_date);
    }

    const invoiceDate = currentDate.toISOString().split('T')[0];
    const dueDateObj = new Date(currentDate);
    dueDateObj.setDate(dueDateObj.getDate() + 14);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    for (const item of selectedItems) {
      try {
        const { data: invoiceNumber, error: numError } = await supabase.rpc('generate_invoice_number');
        if (numError || !invoiceNumber) { failCount++; continue; }

        if (item.type === 'huur') {
          const lease = item.lease!;
          let rentAmount = 0;
          const lineItemsToInsert: any[] = [];

          rentAmount = lease.lease_spaces.reduce((sum, ls) => {
            return sum + (typeof ls.monthly_rent === 'string' ? parseFloat(ls.monthly_rent) : ls.monthly_rent);
          }, 0);

          for (const ls of lease.lease_spaces) {
            let displayName = ls.space.space_number;
            if (ls.space.space_type === 'bedrijfsruimte') {
              const numOnly = displayName.replace(/^(Bedrijfsruimte|Hal)\s*/i, '').trim();
              if (/^\d+/.test(numOnly)) displayName = `Hal ${numOnly}`;
            }
            const sqft = typeof ls.space.square_footage === 'string' ? parseFloat(ls.space.square_footage) : ls.space.square_footage;
            const diversenCalc = (ls.space as any).diversen_calculation;
            const isDiversenFixed = ls.space.space_type === 'diversen' && (!diversenCalc || diversenCalc === 'fixed');
            let quantity = 1;
            if (!isDiversenFixed && sqft && !isNaN(sqft) && sqft > 0) quantity = sqft;
            const pricePerSqm = typeof ls.price_per_sqm === 'string' ? parseFloat(ls.price_per_sqm) : ls.price_per_sqm;
            const monthlyRent = typeof ls.monthly_rent === 'string' ? parseFloat(ls.monthly_rent) : ls.monthly_rent;

            lineItemsToInsert.push({
              description: displayName, quantity, unit_price: pricePerSqm,
              amount: monthlyRent, local_category: getLocalCategory(ls.space.space_type)
            });
          }

          const vatRate = typeof lease.vat_rate === 'string' ? parseFloat(lease.vat_rate) : lease.vat_rate;
          const deposit = typeof lease.security_deposit === 'string' ? parseFloat(lease.security_deposit) : lease.security_deposit;
          const discountPct = lease.tenant?.lease_discount_percentage
            ? (typeof lease.tenant.lease_discount_percentage === 'string' ? parseFloat(lease.tenant.lease_discount_percentage) : lease.tenant.lease_discount_percentage)
            : 0;

          let discountAmount = 0;
          if (discountPct > 0) discountAmount = Math.round(rentAmount * (discountPct / 100) * 100) / 100;

          const baseAmount = Math.round((rentAmount - discountAmount + deposit) * 100) / 100;
          const { subtotal, vatAmount, total } = calculateVAT(baseAmount, vatRate, lease.vat_inclusive);

          const { data: newInvoice, error: invErr } = await supabase
            .from('invoices')
            .insert([{
              lease_id: lease.id, tenant_id: lease.tenant_id,
              invoice_number: invoiceNumber, invoice_date: invoiceDate, due_date: dueDate,
              invoice_month: invoiceMonth, subtotal, vat_amount: vatAmount, amount: total,
              vat_rate: vatRate, vat_inclusive: lease.vat_inclusive, status: 'draft', notes: null
            }]).select().single();

          if (invErr || !newInvoice) { failCount++; continue; }

          if (discountAmount > 0) {
            lineItemsToInsert.push({
              description: `Korting verhuur (${discountPct}%)`, quantity: 1,
              unit_price: -discountAmount, amount: -discountAmount, local_category: null
            });
          }
          if (deposit > 0) {
            lineItemsToInsert.push({
              description: 'Voorschot Gas, Water & Electra', quantity: 1,
              unit_price: deposit, amount: deposit, local_category: 'diversen'
            });
          }

          const { error: liErr } = await supabase
            .from('invoice_line_items')
            .insert(lineItemsToInsert.map(li => ({ ...li, invoice_id: newInvoice.id })));

          if (liErr) {
            await supabase.from('invoices').delete().eq('id', newInvoice.id);
            failCount++;
          } else {
            successCount++;
          }
        } else {
          const bookings = item.bookings || [];
          if (bookings.length === 0) { failCount++; continue; }

          const customerDiscountPct = item.customerDiscountPct || 0;
          let totalBeforeDiscount = 0;
          bookings.forEach((b: any) => {
            const rate = typeof b.applied_rate === 'string' ? parseFloat(b.applied_rate) : (b.applied_rate || 0);
            const hours = typeof b.total_hours === 'string' ? parseFloat(b.total_hours) : (b.total_hours || 0);
            const amt = typeof b.total_amount === 'string' ? parseFloat(b.total_amount) : (b.total_amount || 0);
            const disc = typeof b.discount_amount === 'string' ? parseFloat(b.discount_amount) : (b.discount_amount || 0);
            const gross = rate > 0 && hours > 0 ? rate * hours : amt + disc;
            totalBeforeDiscount += gross;
          });
          const totalDiscountAmount = customerDiscountPct > 0
            ? Math.round(totalBeforeDiscount * (customerDiscountPct / 100) * 100) / 100
            : bookings.reduce((sum: number, b: any) => {
                const disc = typeof b.discount_amount === 'string' ? parseFloat(b.discount_amount) : (b.discount_amount || 0);
                return sum + disc;
              }, 0);

          const finalAmount = totalBeforeDiscount - totalDiscountAmount;
          const { subtotal, vatAmount, total } = calculateVAT(finalAmount, 21, false);

          const notesLines = ['Vergaderruimte boekingen:'];
          bookings.forEach((b: any) => {
            const rateDesc = b.rate_type === 'half_day' ? 'dagdeel' : (b.rate_type === 'full_day' ? 'hele dag' : `${Math.round(b.total_hours)}u`);
            const label = 'Vergaderruimte';
            const bRate = typeof b.applied_rate === 'string' ? parseFloat(b.applied_rate) : (b.applied_rate || 0);
            const bHours = typeof b.total_hours === 'string' ? parseFloat(b.total_hours) : (b.total_hours || 0);
            const totalAmt = typeof b.total_amount === 'string' ? parseFloat(b.total_amount) : (b.total_amount || 0);
            const discAmt = typeof b.discount_amount === 'string' ? parseFloat(b.discount_amount) : (b.discount_amount || 0);
            const amt = bRate > 0 && bHours > 0 ? bRate * bHours : totalAmt + discAmt;
            const start = b.start_time?.substring(0, 5) || '--:--';
            const end = b.end_time?.substring(0, 5) || '--:--';
            notesLines.push(`- ${b.space?.space_number || label} - ${new Date(b.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${start}-${end} (${rateDesc}) = \u20AC${amt.toFixed(2)}`);
          });
          if (totalDiscountAmount > 0) {
            const discLabel = customerDiscountPct > 0 ? `Korting boekingen (${customerDiscountPct}%)` : 'Korting boekingen';
            notesLines.push(`- ${discLabel} = \u20AC-${totalDiscountAmount.toFixed(2)}`);
          }

          const { data: newInvoice, error: invErr } = await supabase
            .from('invoices')
            .insert({
              invoice_number: invoiceNumber,
              tenant_id: item.isExternal ? null : item.customerId,
              external_customer_id: item.isExternal ? item.customerId : null,
              invoice_date: invoiceDate, due_date: dueDate,
              subtotal, vat_amount: vatAmount, amount: total,
              vat_rate: 21, vat_inclusive: false, status: 'draft',
              invoice_month: invoiceMonth, notes: notesLines.join('\n')
            }).select().single();

          if (invErr || !newInvoice) { failCount++; continue; }

          const lineItems = bookings.map((b: any) => {
            const bRate = typeof b.applied_rate === 'string' ? parseFloat(b.applied_rate) : (b.applied_rate || 0);
            const bHours = typeof b.total_hours === 'string' ? parseFloat(b.total_hours) : (b.total_hours || 0);
            const totalAmt = typeof b.total_amount === 'string' ? parseFloat(b.total_amount) : (b.total_amount || 0);
            const discAmt = typeof b.discount_amount === 'string' ? parseFloat(b.discount_amount) : (b.discount_amount || 0);
            const amt = bRate > 0 && bHours > 0 ? bRate * bHours : totalAmt + discAmt;
            const label = 'Vergaderruimte';
            const category = 'vergaderruimte';
            return {
              invoice_id: newInvoice.id,
              description: `${b.space?.space_number || label} - ${new Date(b.booking_date).toLocaleDateString('nl-NL')} ${b.start_time}-${b.end_time}`,
              quantity: b.total_hours, unit_price: b.hourly_rate, amount: amt,
              booking_id: b.id,
              local_category: category
            };
          });

          if (totalDiscountAmount > 0) {
            lineItems.push({
              invoice_id: newInvoice.id,
              description: customerDiscountPct > 0 ? `Korting boekingen (${customerDiscountPct}%)` : 'Korting boekingen',
              quantity: 1, unit_price: -totalDiscountAmount, amount: -totalDiscountAmount,
              booking_id: null, local_category: null as any
            });
          }

          const { error: liErr } = await supabase.from('invoice_line_items').insert(lineItems);
          if (liErr) {
            await supabase.from('invoices').delete().eq('id', newInvoice.id);
            failCount++; continue;
          }

          const meetingIds = bookings.map((b: any) => b.id);
          if (meetingIds.length > 0) {
            await supabase.from('meeting_room_bookings').update({ invoice_id: newInvoice.id }).in('id', meetingIds);
          }
          successCount++;
        }
      } catch {
        failCount++;
      }
    }

    setGenerating(false);

    if (successCount > 0) {
      showToast(`${successCount} factuur${successCount !== 1 ? 'en' : ''} succesvol aangemaakt als concept.`, 'success');
      loadInvoiceableItems();
      onInvoicesCreated?.();
    }
    if (failCount > 0) {
      showToast(`${failCount} factuur${failCount !== 1 ? 'en' : ''} konden niet worden aangemaakt.`, 'error');
    }
  };

  const getTypeLabel = (type: InvoiceItem['type']) => {
    switch (type) {
      case 'huur': return 'Huur';
      case 'meeting_booking': return 'Vergaderruimte';
    }
  };

  const getTypeBadgeColor = (type: InvoiceItem['type']) => {
    switch (type) {
      case 'huur': return 'bg-emerald-900/50 text-emerald-400 border-emerald-700/50';
      case 'meeting_booking': return 'bg-blue-900/50 text-blue-400 border-blue-700/50';
    }
  };

  const huurItems = items.filter(i => i.type === 'huur');
  const bookingItems = items.filter(i => i.type === 'meeting_booking');

  const selectedCount = items.filter(i => selected.has(i.id)).length;
  const selectedTotal = items.filter(i => selected.has(i.id)).reduce((sum, i) => {
    const { total } = calculateVAT(i.amount, i.vatRate, i.vatInclusive);
    return sum + total;
  }, 0);

  const monthLabel = invoiceMonth
    ? new Date(invoiceMonth + '-01').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    : '';

  const renderSection = (title: string, icon: React.ReactNode, sectionItems: InvoiceItem[], color: string, emptyMessage: string) => {
    const sectionSelected = sectionItems.filter(i => selected.has(i.id)).length;
    const allSelected = sectionItems.length > 0 && sectionSelected === sectionItems.length;

    return (
      <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden h-full flex flex-col">
        <div className="px-4 py-3 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {sectionItems.length > 0 && (
              <button
                onClick={() => {
                  if (allSelected) {
                    setSelected(prev => {
                      const next = new Set(prev);
                      sectionItems.forEach(i => next.delete(i.id));
                      return next;
                    });
                  } else {
                    setSelected(prev => {
                      const next = new Set(prev);
                      sectionItems.forEach(i => next.add(i.id));
                      return next;
                    });
                  }
                }}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                {allSelected ? <CheckSquare size={18} className={color} /> : <Square size={18} />}
              </button>
            )}
            {icon}
            <span className="font-medium text-gray-200">{title}</span>
            <span className="text-sm text-gray-400">({sectionItems.length})</span>
          </div>
          {sectionItems.length > 0 && (
            <div className="text-sm text-gray-400">
              {sectionSelected} geselecteerd
            </div>
          )}
        </div>

        {sectionItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12 px-4">
            <p className="text-gray-500 text-sm text-center">{emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700/50">
            {sectionItems.map(item => (
              <div key={item.id} className="group">
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-dark-750 transition-colors">
                  <button onClick={() => toggleItem(item.id)} className="flex-shrink-0">
                    {selected.has(item.id)
                      ? <CheckSquare size={18} className="text-gold-500" />
                      : <Square size={18} className="text-gray-500" />}
                  </button>

                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {expandedItems.has(item.id)
                      ? <ChevronDown size={16} />
                      : <ChevronRight size={16} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-100 truncate">{item.customerName}</span>
                      {item.isExternal && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-dark-700 text-gray-400 border border-dark-600">Extern</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 mt-0.5">{item.description}</div>
                  </div>

                  <div className={`text-xs px-2 py-1 rounded border ${getTypeBadgeColor(item.type)}`}>
                    {getTypeLabel(item.type)}
                  </div>

                  <div className="text-right flex-shrink-0 w-28">
                    <div className="font-semibold text-gray-100">
                      {'\u20AC'}{calculateVAT(item.amount, item.vatRate, item.vatInclusive).total.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      excl. {'\u20AC'}{item.amount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {expandedItems.has(item.id) && item.details.length > 0 && (
                  <div className="px-4 pb-3 pl-16">
                    <div className="bg-dark-900/50 rounded-lg p-3 text-sm text-gray-400 space-y-1">
                      {item.details.map((d, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-gray-600 mt-0.5">-</span>
                          <span>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="flex-shrink-0 bg-dark-900 rounded-lg shadow-lg border border-dark-700 mb-4 overflow-hidden">
        <div className="flex items-center border-b border-dark-700">
          <button
            onClick={() => shiftMonths(-1)}
            className="px-3 py-4 text-gray-500 hover:text-gray-300 hover:bg-dark-800 transition-colors flex-shrink-0"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex flex-1">
            {visibleMonths.map(month => {
              const isActive = month === invoiceMonth;
              const indicator = monthIndicators[month];
              const hasItems = indicator && (indicator.hasLeases || indicator.hasBookings);
              const label = new Date(month + '-01').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });

              return (
                <button
                  key={month}
                  onClick={() => selectMonth(month)}
                  className={`flex-1 relative px-4 py-3.5 text-sm font-medium capitalize transition-all ${
                    isActive
                      ? 'text-gold-500 bg-dark-800'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-dark-800/50'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {label}
                    {hasItems && (
                      <span className={`inline-flex items-center justify-center w-2.5 h-2.5 rounded-full ${
                        isActive ? 'bg-gold-500' : 'bg-emerald-500'
                      }`} />
                    )}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gold-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => shiftMonths(1)}
            className="px-3 py-4 text-gray-500 hover:text-gray-300 hover:bg-dark-800 transition-colors flex-shrink-0"
          >
            <ChevronRight size={18} />
          </button>

          <div className="border-l border-dark-700 px-3">
            <button
              onClick={() => { loadInvoiceableItems(); loadMonthIndicators(visibleMonths); }}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
              title="Vernieuwen"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-gray-100 capitalize">{monthLabel}</span>
            {loading && <Loader2 size={16} className="text-gold-500 animate-spin" />}
          </div>

          <div className="flex items-center gap-4">
            {items.length > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={toggleAll}
                  className="text-gray-400 hover:text-gray-200 transition-colors underline"
                >
                  {selected.size === items.length ? 'Deselecteer alles' : 'Selecteer alles'}
                </button>
                <span className="text-gray-500">|</span>
                <span className="text-gray-300">
                  <span className="font-semibold text-gold-500">{selectedCount}</span> van {items.length} geselecteerd
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="text-gold-500 animate-spin" size={32} />
          </div>
        ) : (
          <div className="space-y-4">
          {pastDueBookings.meetingCount > 0 && (
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-200 font-medium text-sm">
                  Er zijn {pastDueBookings.meetingCount} ongefactureerde boekingen uit eerdere maanden
                </p>
                <p className="text-amber-300/70 text-xs mt-1">
                  {pastDueBookings.months.join(', ')} - Selecteer de betreffende maand om deze boekingen te factureren.
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              {renderSection('Huurcontracten', <Home size={18} className="text-emerald-400" />, huurItems, 'text-emerald-400', 'Geen huurcontracten te factureren voor deze maand.')}
            </div>
            <div>
              {renderSection('Boekingen', <Calendar size={18} className="text-blue-400" />, bookingItems, 'text-blue-400', 'Geen boekingen te factureren voor deze maand.')}
            </div>
          </div>
          </div>
        )}
      </div>

      {items.length > 0 && selectedCount > 0 && (
        <div className="flex-shrink-0 pt-3 border-t border-dark-700 flex justify-end">
          <button
            onClick={generateSelectedInvoices}
            disabled={generating || selectedCount === 0}
            className="px-5 py-2.5 bg-gold-500 text-white font-medium text-sm rounded-lg hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Genereren...
              </>
            ) : (
              `Genereer ${selectedCount} ${selectedCount !== 1 ? 'facturen' : 'factuur'} (${'\u20AC'}${selectedTotal.toFixed(2)} incl. BTW)`
            )}
          </button>
        </div>
      )}

      {toasts.map(toast => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}
