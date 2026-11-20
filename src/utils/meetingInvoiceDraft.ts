import { addCalendarDays, amsterdamCalendar } from './amsterdamCalendar';
import { shiftYearMonth } from './leaseInvoiceEligibility';
import { billableBeforeDiscount, billableUnitPrice, roundMoney, summarizeMeetingInvoice } from './zeroVatPrice';

export type MeetingBookingInput = {
  id?: string | null;
  booking_date: string;
  start_time?: string | null;
  end_time?: string | null;
  total_hours?: number | string | null;
  applied_rate?: number | string | null;
  hourly_rate?: number | string | null;
  rate_type?: string | null;
  total_amount?: number | null;
  discount_amount?: number | null;
  vat_rate?: number | null;
  space_number?: string | null;
};

export type MeetingInvoiceLine = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  booking_id: string | null;
};

export type MeetingInvoiceDraft = {
  invoiceMonth: string;
  invoiceDate: string;
  dueDate: string;
  notes: string;
  subtotal: number;
  vatAmount: number;
  amount: number;
  vatRate: number;
  lines: MeetingInvoiceLine[];
};

type CustomerEmbed = { vat_rate?: number | string | null; meeting_discount_percentage?: number | string | null } | null;

export type MeetingBookingRow = MeetingBookingInput & {
  tenant_id?: string | null;
  external_customer_id?: string | null;
  office_spaces?: { space_number?: string | null } | { space_number?: string | null }[] | null;
  tenants?: CustomerEmbed | CustomerEmbed[];
  external_customers?: CustomerEmbed | CustomerEmbed[];
};

export type MeetingInvoiceGroup = {
  customerId: string;
  customerType: 'tenant' | 'external';
  vatRate: number;
  discountPct: number;
  bookings: MeetingBookingInput[];
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function dutchDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}-${month}-${year}`;
}

function clock(value?: string | null): string {
  return value ? value.substring(0, 5) : '--:--';
}

function rateLabel(booking: MeetingBookingInput): string {
  if (booking.rate_type === 'half_day') return 'dagdeel';
  if (booking.rate_type === 'full_day') return 'hele dag';
  return `${Math.round(Number(booking.total_hours) || 0)}u`;
}

function exclusiveVat(amount: number, vatRate: number) {
  const subtotal = roundMoney(amount);
  const vatAmount = roundMoney(subtotal * (vatRate / 100));
  return { subtotal, vatAmount, total: roundMoney(subtotal + vatAmount) };
}

/** The Amsterdam month before `instant`, with the first and last calendar day. */
export function previousAmsterdamMonth(instant: Date = new Date()) {
  const yearMonth = shiftYearMonth(amsterdamCalendar(instant).yearMonth, -1);
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    yearMonth,
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * One meeting-room invoice for a customer, with the same amounts as the screen.
 * A 0% customer gets the normal 21% inside the price. The header VAT stays 0.
 */
export function buildMeetingInvoiceDraft(
  bookings: MeetingBookingInput[],
  customerVatRate: number,
  discountPct: number,
  invoiceMonth: string,
  instant: Date = new Date(),
): MeetingInvoiceDraft | null {
  if (bookings.length === 0 || !invoiceMonth) return null;
  const vatRate = Number.isFinite(Number(customerVatRate)) ? Number(customerVatRate) : 21;
  const figures = summarizeMeetingInvoice(bookings, vatRate, Number(discountPct) || 0);
  const totals = exclusiveVat(figures.finalAmount, figures.vatRate);
  const calendar = amsterdamCalendar(instant);
  const notes: string[] = ['Vergaderruimte boekingen:'];
  const lines: MeetingInvoiceLine[] = bookings.map((booking) => {
    const amount = billableBeforeDiscount(
      booking.total_amount || 0,
      booking.discount_amount || 0,
      figures.vatRate,
      booking.vat_rate,
    );
    const flat = booking.rate_type === 'half_day' || booking.rate_type === 'full_day';
    const hours = Number(booking.total_hours) || 0;
    const space = booking.space_number || 'Vergaderruimte';
    const when = `${dutchDate(booking.booking_date)} ${clock(booking.start_time)}-${clock(booking.end_time)}`;
    notes.push(`- ${space} - ${when} (${rateLabel(booking)}) = €${amount.toFixed(2)}`);
    return {
      description: `${space} - ${when}`,
      quantity: flat ? 1 : (hours || 1),
      unit_price: flat
        ? amount
        : billableUnitPrice(Number(booking.applied_rate) || Number(booking.hourly_rate) || 0, figures.vatRate, booking.vat_rate),
      amount,
      booking_id: booking.id || null,
    };
  });

  if (figures.discount > 0) {
    const label = Number(discountPct) > 0 ? `Korting boekingen (${discountPct}%)` : 'Korting boekingen';
    notes.push(`- ${label} = €-${figures.discount.toFixed(2)}`);
    lines.push({
      description: label,
      quantity: 1,
      unit_price: -figures.discount,
      amount: -figures.discount,
      booking_id: null,
    });
  }

  return {
    invoiceMonth,
    invoiceDate: calendar.date,
    dueDate: addCalendarDays(calendar.date, 14),
    notes: notes.join('\n'),
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    amount: totals.total,
    vatRate: figures.vatRate,
    lines,
  };
}

/** Invoice total for one booking, including header VAT when the customer pays 21%. */
export function meetingBookingCharge(
  booking: MeetingBookingInput,
  customerVatRate: number,
  discountPct: number,
): number {
  return buildMeetingInvoiceDraft([booking], customerVatRate, discountPct, '2000-01')?.amount ?? 0;
}

/** Group uninvoiced bookings the way the screen puts one customer on one invoice. */
export function groupMeetingBookings(rows: MeetingBookingRow[]): MeetingInvoiceGroup[] {
  const groups = new Map<string, MeetingInvoiceGroup>();
  for (const row of rows) {
    const tenant = one(row.tenants);
    const external = one(row.external_customers);
    const customerType = row.tenant_id ? 'tenant' : 'external';
    const customerId = row.tenant_id || row.external_customer_id;
    if (!customerId) continue;
    const profile = customerType === 'tenant' ? tenant : external;
    const key = `${customerType}:${customerId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        customerId,
        customerType,
        vatRate: Number(profile?.vat_rate ?? 21),
        discountPct: Number(profile?.meeting_discount_percentage) || 0,
        bookings: [],
      };
      groups.set(key, group);
    }
    const space = one(row.office_spaces);
    group.bookings.push({
      id: row.id,
      booking_date: row.booking_date,
      start_time: row.start_time,
      end_time: row.end_time,
      total_hours: row.total_hours,
      applied_rate: row.applied_rate,
      hourly_rate: row.hourly_rate,
      rate_type: row.rate_type,
      total_amount: row.total_amount,
      discount_amount: row.discount_amount,
      vat_rate: row.vat_rate,
      space_number: space?.space_number || row.space_number,
    });
  }
  return Array.from(groups.values());
}
