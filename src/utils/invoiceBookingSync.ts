import { supabase } from '../lib/supabase';
import { calculateVAT, roundMoney } from './invoiceMoney';

export type BookingForInvoice = {
  id: string;
  invoice_id?: string | null;
  total_amount: number;
  discount_amount?: number | null;
  discount_percentage?: number | null;
  total_hours: number;
  rate_type?: string | null;
  applied_rate?: number | null;
  hourly_rate?: number | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  vat_rate?: number | null;
  office_spaces?: { space_number?: string } | null;
  space?: { space_number?: string } | null;
};

export type UnlinkBookingResult = {
  ok: boolean;
  skipped?: boolean;
  invoiceDeleted?: boolean;
  message?: string;
};

export async function getMeetingRoomVatSettings(bookings?: Array<{ vat_rate?: number | null }>) {
  const { data } = await supabase
    .from('space_type_rates')
    .select('space_type, vat_inclusive')
    .in('space_type', ['Meeting Room', 'vergaderruimte']);

  const rateRow =
    data?.find(row => row.space_type === 'Meeting Room') ||
    data?.find(row => row.space_type === 'vergaderruimte') ||
    data?.[0];

  const bookingVat = bookings?.find(booking => booking.vat_rate != null)?.vat_rate;

  return {
    vatRate: Number(bookingVat ?? 21),
    vatInclusive: rateRow?.vat_inclusive ?? false
  };
}

function spaceName(booking: BookingForInvoice) {
  return booking.office_spaces?.space_number || booking.space?.space_number || 'Vergaderruimte';
}

function bookingDescription(booking: BookingForInvoice) {
  const dateStr = new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = `${(booking.start_time || '').substring(0, 5)}-${(booking.end_time || '').substring(0, 5)}`;
  let rateDescription = `${booking.total_hours}u`;
  if (booking.rate_type === 'half_day') rateDescription = 'dagdeel';
  if (booking.rate_type === 'full_day') rateDescription = 'hele dag';
  return `${spaceName(booking)} - ${dateStr} ${timeStr} (${rateDescription})`;
}

export async function recalculateInvoiceFromLineItems(invoiceId: string) {
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, vat_rate, vat_inclusive')
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return { error: invoiceError || new Error('Factuur niet gevonden') };
  }

  const { data: items, error: itemsError } = await supabase
    .from('invoice_line_items')
    .select('amount')
    .eq('invoice_id', invoiceId);

  if (itemsError) {
    return { error: itemsError };
  }

  const baseAmount = roundMoney((items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const { subtotal, vatAmount, total } = calculateVAT(
    baseAmount,
    Number(invoice.vat_rate) || 21,
    !!invoice.vat_inclusive
  );

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      subtotal,
      vat_amount: vatAmount,
      amount: total
    })
    .eq('id', invoiceId);

  if (updateError) {
    return { error: updateError };
  }

  return { subtotal, vatAmount, total };
}

export async function unlinkBookingsForInvoiceIds(invoiceIds: string[]) {
  const ids = invoiceIds.filter(Boolean);
  if (ids.length === 0) return;

  const { error } = await supabase
    .from('meeting_room_bookings')
    .update({ invoice_id: null })
    .in('invoice_id', ids);

  if (error) {
    throw error;
  }
}

export async function removeBookingFromDraftInvoice(
  booking: BookingForInvoice
): Promise<UnlinkBookingResult> {
  if (!booking.invoice_id) {
    return { ok: true, skipped: true };
  }

  const invoiceId = booking.invoice_id;
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('id', invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { ok: false, message: 'Fout bij het ophalen van de factuur.' };
  }

  if (!invoice) {
    await supabase
      .from('meeting_room_bookings')
      .update({ invoice_id: null })
      .eq('id', booking.id);
    return { ok: true, message: 'Factuur niet gevonden; koppeling verwijderd.' };
  }

  if (invoice.status !== 'draft') {
    return {
      ok: true,
      skipped: true,
      message: 'Deze factuur is al verstuurd en kan niet meer worden gewijzigd.'
    };
  }

  const { error: deleteLinesError } = await supabase
    .from('invoice_line_items')
    .delete()
    .eq('invoice_id', invoiceId)
    .eq('booking_id', booking.id);

  if (deleteLinesError) {
    return { ok: false, message: 'Fout bij het verwijderen van factuurregels.' };
  }

  const discountAmount = Number(booking.discount_amount || 0);
  if (discountAmount > 0) {
    const { data: discountLines } = await supabase
      .from('invoice_line_items')
      .select('id, amount')
      .eq('invoice_id', invoiceId)
      .is('booking_id', null)
      .lt('amount', 0);

    const match = (discountLines || []).find(
      line => Math.abs(Number(line.amount) + discountAmount) < 0.005
    );
    if (match) {
      await supabase.from('invoice_line_items').delete().eq('id', match.id);
    }
  }

  const { data: remaining } = await supabase
    .from('invoice_line_items')
    .select('id, booking_id')
    .eq('invoice_id', invoiceId);

  const remainingBookingLines = (remaining || []).filter(line => line.booking_id);

  await supabase
    .from('meeting_room_bookings')
    .update({ invoice_id: null })
    .eq('id', booking.id);

  if (remainingBookingLines.length === 0) {
    await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
    const { error: deleteInvoiceError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId);

    if (deleteInvoiceError) {
      return { ok: false, message: 'Fout bij het verwijderen van de factuur.' };
    }

    await supabase
      .from('meeting_room_bookings')
      .update({ invoice_id: null })
      .eq('invoice_id', invoiceId);

    return { ok: true, invoiceDeleted: true };
  }

  const recalc = await recalculateInvoiceFromLineItems(invoiceId);
  if (recalc.error) {
    return { ok: false, message: 'Fout bij het bijwerken van de factuur.' };
  }

  return { ok: true };
}

export async function addBookingToDraftInvoice(invoiceId: string, booking: BookingForInvoice) {
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error('Factuur niet gevonden');
  }

  if (invoice.status !== 'draft') {
    throw new Error('Alleen conceptfacturen kunnen worden aangepast');
  }

  const { data: existingItem } = await supabase
    .from('invoice_line_items')
    .select('id')
    .eq('invoice_id', invoiceId)
    .eq('booking_id', booking.id)
    .maybeSingle();

  if (!existingItem) {
    const isFlatRate = booking.rate_type === 'half_day' || booking.rate_type === 'full_day';
    const beforeDiscount = Number(booking.total_amount || 0) + Number(booking.discount_amount || 0);
    const qty = isFlatRate ? 1 : Number(booking.total_hours || 0);
    const unitPrice = isFlatRate
      ? beforeDiscount
      : Number(booking.applied_rate || booking.hourly_rate || 0);

    const { error: insertError } = await supabase.from('invoice_line_items').insert({
      invoice_id: invoiceId,
      booking_id: booking.id,
      description: bookingDescription(booking),
      quantity: qty,
      unit_price: unitPrice,
      amount: beforeDiscount,
      local_category: 'vergaderruimte'
    });

    if (insertError) {
      throw insertError;
    }

    const discountAmount = Number(booking.discount_amount || 0);
    if (discountAmount > 0) {
      await supabase.from('invoice_line_items').insert({
        invoice_id: invoiceId,
        booking_id: booking.id,
        description: `Korting ${booking.discount_percentage || 0}% op ${spaceName(booking)}`,
        quantity: 1,
        unit_price: -discountAmount,
        amount: -discountAmount,
        local_category: 'vergaderruimte'
      });
    }
  }

  const { error: linkError } = await supabase
    .from('meeting_room_bookings')
    .update({ invoice_id: invoiceId })
    .eq('id', booking.id);

  if (linkError) {
    throw linkError;
  }

  const recalc = await recalculateInvoiceFromLineItems(invoiceId);
  if (recalc.error) {
    throw recalc.error;
  }
}
