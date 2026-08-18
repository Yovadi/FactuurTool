import { supabase } from '../lib/supabase';
import { calculateVAT } from './money';

export type BookingForInvoiceUnlink = {
  id: string;
  invoice_id?: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_amount: number;
  discount_percentage?: number | null;
  discount_amount?: number | null;
  rate_type?: string | null;
  applied_rate?: number | null;
  hourly_rate?: number | null;
  office_spaces?: { space_number?: string } | { space_number?: string }[] | null;
};

export async function unlinkBookingFromDraftInvoice(
  booking: BookingForInvoiceUnlink
): Promise<{ ok: boolean; error?: string }> {
  if (!booking.invoice_id) return { ok: true };

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', booking.invoice_id)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return { ok: false, error: 'Factuur niet gevonden.' };
  }

  if (invoice.status !== 'draft') {
    return { ok: false, error: 'Deze factuur is al verstuurd en kan niet meer worden gewijzigd.' };
  }

  await supabase
    .from('invoice_line_items')
    .delete()
    .eq('invoice_id', booking.invoice_id)
    .eq('booking_id', booking.id);

  const vatRate = Number(invoice.vat_rate) || 21;
  const vatInclusive = !!invoice.vat_inclusive;
  const bookingAmount = Number(booking.total_amount) || 0;
  const existingBase = vatInclusive ? Number(invoice.amount) : Number(invoice.subtotal);
  const remainingBase = Math.max(0, existingBase - bookingAmount);
  const { subtotal, vatAmount, total } = calculateVAT(remainingBase, vatRate, vatInclusive);

  const dateStr = new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = `${String(booking.start_time).substring(0, 5)}-${String(booking.end_time).substring(0, 5)}`;
  const spaceName = Array.isArray(booking.office_spaces)
    ? booking.office_spaces[0]?.space_number || ''
    : booking.office_spaces?.space_number || '';

  const lines = String(invoice.notes || '').split('\n');
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    const matchesSlot = trimmed.includes(dateStr) && trimmed.includes(timeStr);
    const matchesRoom = !spaceName || trimmed.includes(spaceName);
    if (matchesSlot && matchesRoom) return false;
    if (booking.discount_percentage && trimmed.includes(`Korting ${booking.discount_percentage}%`)) return false;
    return true;
  });
  const updatedNotes = filteredLines.join('\n').trim();

  const { data: remainingItems } = await supabase
    .from('invoice_line_items')
    .select('id')
    .eq('invoice_id', booking.invoice_id);

  const remainingNoteLines = filteredLines.filter((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith('-') && !trimmed.toLowerCase().includes('korting');
  }).length;

  if ((remainingItems?.length || 0) === 0 && remainingNoteLines === 0) {
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', booking.invoice_id)
      .eq('status', 'draft');

    if (deleteError) {
      return { ok: false, error: 'Fout bij het verwijderen van de conceptfactuur.' };
    }
    return { ok: true };
  }

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      subtotal,
      vat_amount: vatAmount,
      amount: total,
      notes: updatedNotes || null,
    })
    .eq('id', booking.invoice_id)
    .eq('status', 'draft');

  if (updateError) {
    return { ok: false, error: 'Fout bij het bijwerken van de factuur.' };
  }

  return { ok: true };
}
