import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, Plus, X, Check, AlertCircle, Trash2, CalendarDays, FileText, CheckCircle, XCircle, Info, DollarSign, Save } from 'lucide-react';
import { BookingCalendar } from './BookingCalendar';
import { InlineDatePicker } from './InlineDatePicker';

type NotificationType = 'success' | 'error' | 'info';

type Notification = {
  id: number;
  message: string;
  type: NotificationType;
};

type Tenant = {
  id: string;
  name: string;
  company_name: string;
};

type Space = {
  id: string;
  space_number: string;
  hourly_rate?: number;
};

type Booking = {
  id: string;
  space_id: string;
  tenant_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  total_hours: number;
  total_amount: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  notes: string;
  invoice_id: string | null;
  tenants?: { name: string; company_name: string };
  office_spaces?: { space_number: string };
};

export function MeetingRoomBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [meetingRooms, setMeetingRooms] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedView, setSelectedView] = useState<'list' | 'calendar' | 'rates'>('calendar');
  const [selectedFilter, setSelectedFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationId, setNotificationId] = useState(0);

  const [formData, setFormData] = useState({
    space_id: '',
    tenant_id: '',
    booking_date: '',
    start_time: '09:00',
    end_time: '10:00',
    hourly_rate: 25,
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('id, name, company_name')
      .order('name');

    const { data: spacesData } = await supabase
      .from('office_spaces')
      .select('id, space_number, hourly_rate')
      .eq('space_type', 'Meeting Room')
      .order('space_number');

    const { data: bookingsData } = await supabase
      .from('meeting_room_bookings')
      .select(`
        *,
        tenants(name, company_name),
        office_spaces(space_number)
      `)
      .eq('status', 'confirmed')
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    const sortedBookings = (bookingsData || []).sort((a, b) => {
      const companyA = a.tenants?.company_name || a.tenants?.name || '';
      const companyB = b.tenants?.company_name || b.tenants?.name || '';

      const companyCompare = companyA.localeCompare(companyB);
      if (companyCompare !== 0) return companyCompare;

      const dateCompare = a.booking_date.localeCompare(b.booking_date);
      if (dateCompare !== 0) return dateCompare;

      return a.start_time.localeCompare(b.start_time);
    });

    setTenants(tenantsData || []);
    setMeetingRooms(spacesData || []);
    setAllBookings(sortedBookings);
    applyFilter(sortedBookings, selectedFilter);
    setLoading(false);
  };

  const applyFilter = (bookingsList: Booking[], filter: 'upcoming' | 'past' | 'all') => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let filtered = bookingsList;

    if (filter === 'upcoming') {
      filtered = bookingsList.filter(b => b.booking_date >= todayStr && b.status !== 'cancelled');
    } else if (filter === 'past') {
      filtered = bookingsList.filter(b => b.booking_date < todayStr);
    }

    setBookings(filtered);
  };

  const showNotification = (message: string, type: NotificationType = 'info') => {
    const id = notificationId;
    setNotificationId(id + 1);
    setNotifications(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const calculateTotalHours = (startTime: string, endTime: string) => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.booking_date) {
      showNotification('Selecteer een datum voor de boeking.', 'error');
      return;
    }

    if (!formData.space_id) {
      showNotification('Selecteer een vergaderruimte.', 'error');
      return;
    }

    if (!formData.tenant_id) {
      showNotification('Selecteer een huurder.', 'error');
      return;
    }

    const { data: existingBookings } = await supabase
      .from('meeting_room_bookings')
      .select('id, start_time, end_time')
      .eq('space_id', formData.space_id)
      .eq('booking_date', formData.booking_date)
      .neq('status', 'cancelled');

    if (existingBookings && existingBookings.length > 0) {
      const newStart = formData.start_time;
      const newEnd = formData.end_time;

      const hasOverlap = existingBookings.some(booking => {
        const existingStart = booking.start_time;
        const existingEnd = booking.end_time;

        return (
          (newStart >= existingStart && newStart < existingEnd) ||
          (newEnd > existingStart && newEnd <= existingEnd) ||
          (newStart <= existingStart && newEnd >= existingEnd)
        );
      });

      if (hasOverlap) {
        showNotification('Deze ruimte is al geboekt voor de geselecteerde tijd. Kies een andere tijd of ruimte.', 'error');
        return;
      }
    }

    const totalHours = calculateTotalHours(formData.start_time, formData.end_time);
    const totalAmount = totalHours * formData.hourly_rate;

    const { data, error } = await supabase
      .from('meeting_room_bookings')
      .insert({
        space_id: formData.space_id,
        tenant_id: formData.tenant_id,
        booking_date: formData.booking_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        hourly_rate: formData.hourly_rate,
        total_hours: totalHours,
        total_amount: totalAmount,
        status: 'confirmed',
        notes: formData.notes
      })
      .select(`
        *,
        tenants(name, company_name),
        office_spaces(space_number)
      `)
      .single();

    if (error) {
      console.error('Error creating booking:', error.message);
      showNotification('Er is een fout opgetreden bij het aanmaken van de boeking.', 'error');
      return;
    }

    if (data) {
      await createOrUpdateInvoiceForBooking(data);
      setBookings([data, ...bookings]);
    }

    showNotification('Boeking succesvol aangemaakt en factuur bijgewerkt!', 'success');
    setShowForm(false);
    setFormData({
      space_id: '',
      tenant_id: '',
      booking_date: '',
      start_time: '09:00',
      end_time: '10:00',
      hourly_rate: 25,
      notes: ''
    });
  };

  const handleStatusChange = async (bookingId: string, newStatus: 'confirmed' | 'cancelled' | 'completed') => {
    // Haal de boeking op voordat we de status wijzigen
    const booking = bookings.find(b => b.id === bookingId);

    if (!booking) {
      showNotification('Boeking niet gevonden.', 'error');
      return;
    }

    // Als de status verandert naar cancelled, update de factuur
    if (newStatus === 'cancelled' && booking.invoice_id) {
      await removeBookingFromInvoice(booking);
    }

    const { error } = await supabase
      .from('meeting_room_bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating status:', error.message);
      showNotification('Fout bij het bijwerken van de status.', 'error');
      return;
    }

    const statusText = newStatus === 'confirmed' ? 'bevestigd' : newStatus === 'cancelled' ? 'geannuleerd' : 'voltooid';
    showNotification(`Boeking is ${statusText}.`, 'success');

    setBookings(bookings.map(b =>
      b.id === bookingId ? { ...b, status: newStatus } : b
    ));
  };

  const handleDelete = async (bookingId: string) => {
    if (!confirm('Weet je zeker dat je deze boeking wilt verwijderen?')) {
      return;
    }

    // Haal de boeking op voordat we deze verwijderen
    const booking = bookings.find(b => b.id === bookingId);

    if (!booking) {
      showNotification('Boeking niet gevonden.', 'error');
      return;
    }

    // Als de boeking aan een factuur is gekoppeld, update de factuur
    if (booking.invoice_id) {
      await removeBookingFromInvoice(booking);
    }

    const { error } = await supabase
      .from('meeting_room_bookings')
      .delete()
      .eq('id', bookingId);

    if (error) {
      console.error('Error deleting booking:', error.message);
      showNotification('Fout bij het verwijderen van de boeking.', 'error');
      return;
    }

    showNotification('Boeking succesvol verwijderd.', 'success');
    setBookings(bookings.filter(b => b.id !== bookingId));
  };

  const removeBookingFromInvoice = async (booking: Booking) => {
    if (!booking.invoice_id) {
      return;
    }

    // Haal de factuur op
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', booking.invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error('Error fetching invoice:', invoiceError);
      return;
    }

    // Alleen draft facturen kunnen worden aangepast
    if (invoice.status !== 'draft') {
      showNotification('Deze factuur is al verstuurd en kan niet meer worden gewijzigd.', 'error');
      return;
    }

    const vatRate = invoice.vat_rate;

    // Bereken nieuwe bedragen zonder deze boeking
    const newSubtotal = Math.max(0, parseFloat(invoice.subtotal) - booking.total_amount);
    const newVatAmount = newSubtotal * (vatRate / 100);
    const newTotal = newSubtotal + newVatAmount;

    // Verwijder de boeking uit de notes
    const bookingLine = `- ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)} (${booking.total_hours}u) = €${booking.total_amount.toFixed(2)}`;

    let updatedNotes = invoice.notes || '';
    const lines = updatedNotes.split('\n');
    const filteredLines = lines.filter(line => line.trim() !== bookingLine.trim());
    updatedNotes = filteredLines.join('\n').trim();

    // Als er geen boekingen meer zijn, verwijder de factuur
    const remainingBookingLines = filteredLines.filter(line => line.startsWith('-')).length;

    if (remainingBookingLines === 0) {
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', booking.invoice_id);

      if (deleteError) {
        console.error('Error deleting invoice:', deleteError);
        showNotification('Fout bij het verwijderen van de factuur.', 'error');
        return;
      }

      showNotification('Factuur is verwijderd omdat er geen boekingen meer zijn.', 'info');
      return;
    }

    // Update de factuur
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        subtotal: newSubtotal,
        vat_amount: newVatAmount,
        amount: newTotal,
        notes: updatedNotes || null
      })
      .eq('id', booking.invoice_id);

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      showNotification('Fout bij het bijwerken van de factuur.', 'error');
      return;
    }

    showNotification('Factuur is bijgewerkt.', 'info');
  };

  const createOrUpdateInvoiceForBooking = async (booking: Booking) => {
    const bookingDate = new Date(booking.booking_date + 'T00:00:00');
    const invoiceMonth = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;

    const vatRate = 21;

    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id, subtotal, vat_amount, amount, notes')
      .eq('tenant_id', booking.tenant_id)
      .eq('invoice_month', invoiceMonth)
      .eq('status', 'draft')
      .maybeSingle();

    const bookingLine = `- ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)} (${booking.total_hours}u) = €${booking.total_amount.toFixed(2)}`;

    if (existingInvoice) {
      const newSubtotal = parseFloat(existingInvoice.subtotal) + booking.total_amount;
      const newVatAmount = newSubtotal * (vatRate / 100);
      const newTotal = newSubtotal + newVatAmount;
      const updatedNotes = existingInvoice.notes ? `${existingInvoice.notes}\n${bookingLine}` : `Vergaderruimte boekingen:\n${bookingLine}`;

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          subtotal: newSubtotal,
          vat_amount: newVatAmount,
          amount: newTotal,
          notes: updatedNotes
        })
        .eq('id', existingInvoice.id);

      if (updateError) {
        console.error('Error updating invoice:', updateError.message);
        showNotification('Fout bij het bijwerken van de factuur.', 'error');
        return;
      }

      const { error: linkError } = await supabase
        .from('meeting_room_bookings')
        .update({ invoice_id: existingInvoice.id })
        .eq('id', booking.id);

      if (linkError) {
        console.error('Error linking booking to invoice:', linkError.message);
      }
    } else {
      const invoiceDate = new Date().toISOString().split('T')[0];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const subtotal = booking.total_amount;
      const vatAmount = subtotal * (vatRate / 100);
      const totalAmount = subtotal + vatAmount;

      const { data: invoiceNumberResult } = await supabase
        .rpc('generate_invoice_number');

      const invoiceNumber = invoiceNumberResult || 'INV-ERROR';

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          tenant_id: booking.tenant_id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDateStr,
          invoice_month: invoiceMonth,
          status: 'draft',
          subtotal: subtotal,
          vat_amount: vatAmount,
          vat_rate: vatRate,
          amount: totalAmount,
          notes: `Vergaderruimte boekingen:\n${bookingLine}`
        })
        .select()
        .single();

      if (invoiceError || !invoiceData) {
        console.error('Error creating invoice:', invoiceError?.message);
        showNotification('Fout bij het aanmaken van de factuur.', 'error');
        return;
      }

      const { error: linkError } = await supabase
        .from('meeting_room_bookings')
        .update({ invoice_id: invoiceData.id })
        .eq('id', booking.id);

      if (linkError) {
        console.error('Error linking booking to invoice:', linkError.message);
      }
    }
  };

  const handleGenerateInvoice = async (booking: Booking) => {
    if (booking.invoice_id) {
      return;
    }

    await createOrUpdateInvoiceForBooking(booking);

    showNotification('Factuur succesvol aangemaakt!', 'success');

    // Reload only the bookings data without refreshing the entire component
    const { data: bookingsData } = await supabase
      .from('meeting_room_bookings')
      .select('*, tenants(name, company_name), office_spaces(space_number)')
      .order('booking_date', { ascending: true });

    if (bookingsData) {
      setAllBookings(bookingsData as Booking[]);
      applyFilter(bookingsData as Booking[], selectedFilter);
    }
  };

  const handleSpaceChange = (spaceId: string) => {
    const selectedRoom = meetingRooms.find(r => r.id === spaceId);
    setFormData({
      ...formData,
      space_id: spaceId,
      hourly_rate: selectedRoom?.hourly_rate || 25
    });
  };

  if (loading) {
    return <div className="text-center py-8">Boekingen laden...</div>;
  }

  return (
    <div>
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border backdrop-blur-sm animate-slide-in ${
              notification.type === 'success'
                ? 'bg-green-900/90 border-green-700 text-green-100'
                : notification.type === 'error'
                ? 'bg-red-900/90 border-red-700 text-red-100'
                : 'bg-blue-900/90 border-blue-700 text-blue-100'
            }`}
          >
            {notification.type === 'success' && <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />}
            {notification.type === 'error' && <XCircle size={20} className="flex-shrink-0 mt-0.5" />}
            {notification.type === 'info' && <Info size={20} className="flex-shrink-0 mt-0.5" />}
            <p className="text-sm font-medium flex-1">{notification.message}</p>
            <button
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Vergaderruimte Boekingen</h1>
        <p className="text-gray-300">Beheer boekingen voor vergaderruimtes op uurbasis</p>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => setSelectedView('calendar')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              selectedView === 'calendar'
                ? 'bg-gold-600 text-white'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            <CalendarDays size={18} />
            Kalender
          </button>
          <button
            onClick={() => setSelectedView('list')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              selectedView === 'list'
                ? 'bg-gold-600 text-white'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            <AlertCircle size={18} />
            Lijst
          </button>
          <button
            onClick={() => setSelectedView('rates')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              selectedView === 'rates'
                ? 'bg-gold-600 text-white'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            <DollarSign size={18} />
            Tarieven
          </button>
        </div>

        {selectedView === 'list' && (
          <div className="flex gap-4">
            <button
              onClick={() => {
                setSelectedFilter('upcoming');
                applyFilter(allBookings, 'upcoming');
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedFilter === 'upcoming'
                  ? 'bg-gold-600 text-white'
                  : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
              }`}
            >
              Aankomend
            </button>
            <button
              onClick={() => {
                setSelectedFilter('past');
                applyFilter(allBookings, 'past');
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedFilter === 'past'
                  ? 'bg-gold-600 text-white'
                  : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
              }`}
            >
              Afgelopen
            </button>
            <button
              onClick={() => {
                setSelectedFilter('all');
                applyFilter(allBookings, 'all');
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedFilter === 'all'
                  ? 'bg-gold-600 text-white'
                  : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
              }`}
            >
              Alle
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-100">Nieuwe Boeking</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Vergaderruimte
                </label>
                <select
                  value={formData.space_id}
                  onChange={(e) => handleSpaceChange(e.target.value)}
                  className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecteer een ruimte</option>
                  {meetingRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.space_number} {room.hourly_rate && `- €${room.hourly_rate}/uur`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Huurder
                </label>
                <select
                  value={formData.tenant_id}
                  onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecteer een huurder</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} {tenant.company_name && `(${tenant.company_name})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Datum
                  </label>
                  <InlineDatePicker
                    value={formData.booking_date}
                    onChange={(date) => setFormData({ ...formData, booking_date: date })}
                    minDate={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="flex flex-col gap-4 flex-1">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Starttijd
                      </label>
                      <select
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                        size={5}
                        required
                      >
                        {Array.from({ length: 20 }, (_, i) => {
                          const hour = Math.floor(i / 2) + 8;
                          const minute = (i % 2) * 30;
                          const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                          return (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Eindtijd
                      </label>
                      <select
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                        size={5}
                        required
                      >
                        {Array.from({ length: 20 }, (_, i) => {
                          const hour = Math.floor(i / 2) + 8;
                          const minute = (i % 2) * 30;
                          const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                          return (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Uurtarief (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.hourly_rate}
                        onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Totaalbedrag
                      </label>
                      <div className="px-4 py-2 border border-dark-600 rounded-lg bg-dark-800 text-gray-100">
                        €{(calculateTotalHours(formData.start_time, formData.end_time) * formData.hourly_rate).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Notities
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 border border-dark-600 rounded-lg text-gray-300 hover:bg-dark-700 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 transition-colors"
                >
                  Boeking Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedView === 'calendar' ? (
        <BookingCalendar />
      ) : selectedView === 'rates' ? (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="text-gold-500" size={24} />
            <h2 className="text-xl font-semibold text-gray-100">Vergaderruimte Tarieven</h2>
          </div>

          <div className="space-y-4">
            {meetingRooms.length === 0 ? (
              <p className="text-center py-8 text-gray-400">Geen vergaderruimtes gevonden</p>
            ) : (
              meetingRooms.map((space) => (
                <div
                  key={space.id}
                  className="flex items-center justify-between p-4 bg-dark-800 rounded-lg border border-dark-700 hover:border-gold-600 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-100">{space.space_number}</h3>
                    <p className="text-sm text-gray-400">Vergaderruimte</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-300">€</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={space.hourly_rate || 25}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          setMeetingRooms(meetingRooms.map(s => s.id === space.id ? { ...s, hourly_rate: value } : s));
                        }}
                        className="w-24 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                      />
                      <span className="text-sm text-gray-300">/uur</span>
                    </div>

                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from('office_spaces')
                          .update({ hourly_rate: space.hourly_rate || 25 })
                          .eq('id', space.id);

                        if (error) {
                          console.error('Error updating rate:', error.message);
                          showNotification('Fout bij het bijwerken van het tarief.', 'error');
                          return;
                        }

                        showNotification('Tarief succesvol bijgewerkt!', 'success');
                      }}
                      className="bg-gold-600 text-white px-4 py-2 rounded-lg hover:bg-gold-700 transition-colors flex items-center gap-2"
                    >
                      <Save size={18} />
                      Opslaan
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-300">
                <p className="font-medium mb-1">Let op:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Deze tarieven zijn van toepassing op nieuwe boekingen</li>
                  <li>Bestaande boekingen behouden hun originele tarief</li>
                  <li>Tarieven zijn zichtbaar op de publieke boekingspagina</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-dark-800 border-b border-dark-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Datum & Tijd
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Ruimte
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Huurder
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Duur
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Bedrag
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Geen boekingen gevonden
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-dark-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-200 font-medium">
                        {new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-200">
                        {booking.office_spaces?.space_number}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-200">{booking.tenants?.name}</div>
                      {booking.tenants?.company_name && (
                        <div className="text-xs text-gray-400 mt-0.5">{booking.tenants.company_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-200">
                        {booking.total_hours.toFixed(1)} uur
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        €{booking.hourly_rate}/uur
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-200">
                        €{booking.total_amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                          booking.status === 'confirmed'
                            ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
                            : booking.status === 'completed'
                            ? 'bg-green-900/50 text-green-300 border border-green-700/50'
                            : 'bg-red-900/50 text-red-300 border border-red-700/50'
                        }`}
                      >
                        {booking.status === 'confirmed'
                          ? 'Bevestigd'
                          : booking.status === 'completed'
                          ? 'Voltooid'
                          : 'Geannuleerd'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {!booking.invoice_id && booking.status === 'completed' && (
                          <button
                            onClick={() => handleGenerateInvoice(booking)}
                            className="text-gold-400 hover:text-gold-300"
                            title="Factuur aanmaken"
                          >
                            <FileText size={18} />
                          </button>
                        )}
                        {booking.invoice_id && (
                          <span className="text-xs text-green-400" title="Gefactureerd">
                            <FileText size={18} />
                          </span>
                        )}
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'completed')}
                            className="text-green-400 hover:text-green-300"
                            title="Markeer als voltooid"
                          >
                            <Check size={18} />
                          </button>
                        )}
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'cancelled')}
                            className="text-red-400 hover:text-red-300"
                            title="Annuleer boeking"
                          >
                            <AlertCircle size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(booking.id)}
                          className="text-gray-400 hover:text-red-400"
                          title="Verwijder boeking"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
