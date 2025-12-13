import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, Plus, X, Check, AlertCircle, Trash2, CalendarDays, FileText, CheckCircle, XCircle, Info } from 'lucide-react';
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

type ExternalCustomer = {
  id: string;
  company_name: string;
  contact_name: string;
  email?: string;
  phone?: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
};

type Booking = {
  id: string;
  space_id: string;
  tenant_id: string | null;
  external_customer_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  total_hours: number;
  total_amount: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  notes: string;
  invoice_id: string | null;
  booking_type: 'tenant' | 'external';
  tenants?: { name: string; company_name: string };
  external_customers?: ExternalCustomer;
  office_spaces?: { space_number: string };
};

type MeetingRoomBookingsProps = {
  loggedInTenantId?: string | null;
};

export function MeetingRoomBookings({ loggedInTenantId = null }: MeetingRoomBookingsProps = {}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<ExternalCustomer[]>([]);
  const [meetingRooms, setMeetingRooms] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedView, setSelectedView] = useState<'list' | 'calendar'>('calendar');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'internal' | 'external' | 'upcoming' | 'invoiced'>('all');
  const [selectedTab, setSelectedTab] = useState<'tenant' | 'external'>('tenant');
  const [bookingType, setBookingType] = useState<'tenant' | 'external'>('tenant');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationId, setNotificationId] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const [formData, setFormData] = useState({
    space_id: '',
    tenant_id: '',
    external_customer_id: '',
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

    const { data: externalCustomersData } = await supabase
      .from('external_customers')
      .select('id, company_name, contact_name, email, phone, street, postal_code, city, country')
      .order('company_name');

    const { data: spacesData } = await supabase
      .from('office_spaces')
      .select('id, space_number, hourly_rate')
      .eq('space_type', 'Meeting Room')
      .order('space_number');

    let bookingsQuery = supabase
      .from('meeting_room_bookings')
      .select(`
        *,
        tenants(name, company_name),
        external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country),
        office_spaces(space_number)
      `)
      .neq('status', 'cancelled')
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (loggedInTenantId) {
      bookingsQuery = bookingsQuery.eq('tenant_id', loggedInTenantId);
    }

    const { data: bookingsData } = await bookingsQuery;

    const sortedBookings = (bookingsData || []).sort((a, b) => {
      const companyA = a.booking_type === 'external'
        ? a.external_customers?.company_name || ''
        : a.tenants?.company_name || a.tenants?.name || '';
      const companyB = b.booking_type === 'external'
        ? b.external_customers?.company_name || ''
        : b.tenants?.company_name || b.tenants?.name || '';

      const companyCompare = companyA.localeCompare(companyB);
      if (companyCompare !== 0) return companyCompare;

      const dateCompare = a.booking_date.localeCompare(b.booking_date);
      if (dateCompare !== 0) return dateCompare;

      return a.start_time.localeCompare(b.start_time);
    });

    setTenants(tenantsData || []);
    setExternalCustomers(externalCustomersData || []);
    setMeetingRooms(spacesData || []);
    setAllBookings(sortedBookings);
    applyFilter(sortedBookings, selectedFilter);
    setLoading(false);
  };

  const applyFilter = (bookingsList: Booking[], filter: 'all' | 'internal' | 'external' | 'upcoming' | 'invoiced', tab?: 'tenant' | 'external') => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let filtered = bookingsList;

    if (filter === 'all') {
      // Show only bookings without invoice (not yet processed)
      filtered = bookingsList.filter(b => !b.invoice_id);
    } else if (filter === 'internal') {
      // Only tenant bookings
      filtered = bookingsList.filter(b => b.booking_type === 'tenant');
    } else if (filter === 'external') {
      // Only external bookings
      filtered = bookingsList.filter(b => b.booking_type === 'external');
    } else if (filter === 'upcoming') {
      // Future bookings without invoice
      filtered = bookingsList.filter(b => b.booking_date >= todayStr && !b.invoice_id);
    } else if (filter === 'invoiced') {
      // Bookings with invoice
      filtered = bookingsList.filter(b => b.invoice_id !== null);
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

  const handleTabChange = (tab: 'tenant' | 'external') => {
    setSelectedTab(tab);
    setBookingType(tab);
    applyFilter(allBookings, selectedFilter, tab);
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

    if (bookingType === 'tenant') {
      const tenantId = loggedInTenantId || formData.tenant_id;
      if (!tenantId) {
        showNotification('Selecteer een huurder.', 'error');
        return;
      }
    } else {
      if (!formData.external_company_name) {
        showNotification('Vul een bedrijfsnaam in.', 'error');
        return;
      }
      if (!formData.external_contact_name) {
        showNotification('Vul een contactpersoon in.', 'error');
        return;
      }
      if (!formData.external_street) {
        showNotification('Vul een straat en huisnummer in.', 'error');
        return;
      }
      if (!formData.external_postal_code) {
        showNotification('Vul een postcode in.', 'error');
        return;
      }
      if (!formData.external_city) {
        showNotification('Vul een plaats in.', 'error');
        return;
      }
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

    const insertData: any = {
      space_id: formData.space_id,
      booking_date: formData.booking_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      hourly_rate: formData.hourly_rate,
      total_hours: totalHours,
      total_amount: totalAmount,
      status: 'confirmed',
      notes: formData.notes,
      booking_type: bookingType
    };

    if (bookingType === 'tenant') {
      const tenantId = loggedInTenantId || formData.tenant_id;
      insertData.tenant_id = tenantId;
      insertData.external_customer_id = null;
    } else {
      insertData.tenant_id = null;
      insertData.external_customer_id = formData.external_customer_id;
    }

    const { data, error } = await supabase
      .from('meeting_room_bookings')
      .insert(insertData)
      .select(`
        *,
        tenants(name, company_name),
        external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country),
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
      external_customer_id: '',
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

    // Update state to reflect status change or remove if cancelled
    if (newStatus === 'cancelled') {
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      setAllBookings(prev => prev.filter(b => b.id !== bookingId));
    } else {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    }

    const statusText = newStatus === 'confirmed' ? 'bevestigd' : newStatus === 'cancelled' ? 'geannuleerd' : 'voltooid';
    showNotification(`Boeking is ${statusText}.`, 'success');
  };

  const confirmDelete = (bookingId: string) => {
    setDeleteConfirmId(bookingId);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const bookingId = deleteConfirmId;
    setDeleteConfirmId(null);

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

    // Update state to remove the deleted booking
    setBookings(prev => prev.filter(b => b.id !== bookingId));
    setAllBookings(prev => prev.filter(b => b.id !== bookingId));

    showNotification('Boeking succesvol verwijderd.', 'success');
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

    let existingInvoiceQuery = supabase
      .from('invoices')
      .select('id, subtotal, vat_amount, amount, notes')
      .eq('invoice_month', invoiceMonth)
      .eq('status', 'draft');

    if (booking.booking_type === 'tenant') {
      existingInvoiceQuery = existingInvoiceQuery.eq('tenant_id', booking.tenant_id);
    } else {
      existingInvoiceQuery = existingInvoiceQuery.eq('external_customer_id', booking.external_customer_id);
    }

    const { data: existingInvoice, error: queryError } = await existingInvoiceQuery.maybeSingle();

    if (queryError) {
      console.error('Error querying invoice:', queryError);
      throw new Error('Fout bij het zoeken naar bestaande factuur');
    }

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
        console.error('Error updating invoice:', updateError);
        throw new Error('Fout bij het bijwerken van de factuur');
      }

      const { error: linkError } = await supabase
        .from('meeting_room_bookings')
        .update({ invoice_id: existingInvoice.id })
        .eq('id', booking.id);

      if (linkError) {
        console.error('Error linking booking to invoice:', linkError);
        throw new Error('Fout bij het koppelen van boeking aan factuur');
      }

      showNotification('Factuur succesvol bijgewerkt', 'success');
    } else {
      const invoiceDate = new Date().toISOString().split('T')[0];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const subtotal = booking.total_amount;
      const vatAmount = subtotal * (vatRate / 100);
      const totalAmount = subtotal + vatAmount;

      const { data: invoiceNumberResult, error: rpcError } = await supabase
        .rpc('generate_invoice_number');

      if (rpcError) {
        console.error('Error generating invoice number:', rpcError);
        throw new Error('Fout bij het genereren van factuurnummer');
      }

      const invoiceNumber = invoiceNumberResult || 'INV-ERROR';

      const invoiceInsertData: any = {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDateStr,
        invoice_month: invoiceMonth,
        status: 'draft',
        subtotal: subtotal,
        vat_amount: vatAmount,
        vat_rate: vatRate,
        vat_inclusive: false,
        amount: totalAmount,
        notes: `Vergaderruimte boekingen:\n${bookingLine}`
      };

      if (booking.booking_type === 'tenant') {
        invoiceInsertData.tenant_id = booking.tenant_id;
      } else {
        invoiceInsertData.external_customer_id = booking.external_customer_id;
      }

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceInsertData)
        .select()
        .single();

      if (invoiceError || !invoiceData) {
        console.error('Error creating invoice:', invoiceError);
        throw new Error('Fout bij het aanmaken van de factuur');
      }

      const { error: linkError } = await supabase
        .from('meeting_room_bookings')
        .update({ invoice_id: invoiceData.id })
        .eq('id', booking.id);

      if (linkError) {
        console.error('Error linking booking to invoice:', linkError);
        throw new Error('Fout bij het koppelen van boeking aan factuur');
      }

      showNotification('Factuur succesvol aangemaakt', 'success');
    }
  };

  const handleGenerateInvoice = async (booking: Booking) => {
    if (booking.invoice_id) {
      return;
    }

    try {
      await createOrUpdateInvoiceForBooking(booking);

      const { data: updatedBooking } = await supabase
        .from('meeting_room_bookings')
        .select(`
          *,
          tenants(name, company_name),
          external_customers(company_name, contact_name, email, phone, street, postal_code, city, country),
          office_spaces(space_number)
        `)
        .eq('id', booking.id)
        .single();

      if (updatedBooking) {
        setBookings(prev => prev.map(b => b.id === booking.id ? updatedBooking : b));
        setAllBookings(prev => prev.map(b => b.id === booking.id ? updatedBooking : b));
      }

      await loadData();
    } catch (error) {
      console.error('Error generating invoice:', error);
      showNotification('Fout bij het genereren van de factuur', 'error');
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

  // Check if running in production (Netlify) - only show calendar view
  const isProduction = !import.meta.env.DEV && typeof window !== 'undefined' && !(window as any).electron;

  return (
    <div className={isProduction ? 'min-h-screen bg-dark-950 flex items-start justify-center p-4' : ''}>
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

      {!isProduction && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-100 mb-4">Vergaderruimte Boekingen</h1>
            <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedView('calendar')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    selectedView === 'calendar'
                      ? 'bg-gold-500 text-dark-950'
                      : 'text-gray-300 hover:bg-dark-800'
                  }`}
                >
                  <CalendarDays size={18} />
                  Kalender
                </button>
                <button
                  onClick={() => setSelectedView('list')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    selectedView === 'list'
                      ? 'bg-gold-500 text-dark-950'
                      : 'text-gray-300 hover:bg-dark-800'
                  }`}
                >
                  <AlertCircle size={18} />
                  Lijst
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {!isProduction && showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-2xl my-8 mx-4">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Nieuwe Boeking</h3>

            <div className="flex gap-2 mb-4">
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setBookingType('tenant')}
                  className={`px-4 py-2 font-medium rounded-lg transition-all ${
                    bookingType === 'tenant'
                      ? 'bg-gold-500 text-white shadow-lg'
                      : 'bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-gray-300'
                  }`}
                >
                  Huurder
                </button>
                <button
                  type="button"
                  onClick={() => setBookingType('external')}
                  className={`px-4 py-2 font-medium rounded-lg transition-all ${
                    bookingType === 'external'
                      ? 'bg-gold-500 text-white shadow-lg'
                      : 'bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-gray-300'
                  }`}
                >
                  Externe partij
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Vergaderruimte
                </label>
                <select
                  value={formData.space_id}
                  onChange={(e) => handleSpaceChange(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
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

              {!loggedInTenantId && bookingType === 'tenant' && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Huurder
                  </label>
                  <select
                    value={formData.tenant_id}
                    onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
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
              )}

              {bookingType === 'external' && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Externe klant *
                  </label>
                  <select
                    value={formData.external_customer_id}
                    onChange={(e) => setFormData({ ...formData, external_customer_id: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    required
                  >
                    <option value="">Selecteer een externe klant</option>
                    {externalCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name} ({customer.contact_name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
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
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Starttijd
                      </label>
                      <select
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
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
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Eindtijd
                      </label>
                      <select
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
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
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Uurtarief (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.hourly_rate}
                        onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                        required
                      />
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Totaalbedrag
                      </label>
                      <div className="px-3 py-2 bg-dark-800 text-gray-100 rounded">
                        €{(calculateTotalHours(formData.start_time, formData.end_time) * formData.hourly_rate).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Notities
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-dark-700 text-gray-200 rounded-lg hover:bg-dark-600 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors"
                >
                  Boeking Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(isProduction || selectedView === 'calendar') ? (
        <div className={isProduction ? 'w-full max-w-7xl' : ''}>
          <BookingCalendar
            loggedInTenantId={loggedInTenantId}
            onBookingChange={async (action, bookingId) => {
          if (action === 'cancelled') {
            // Remove cancelled booking from lists
            setBookings(prev => prev.filter(b => b.id !== bookingId));
            setAllBookings(prev => prev.filter(b => b.id !== bookingId));
          } else if (action === 'created') {
            // Fetch the new booking and add to lists
            const { data: newBooking } = await supabase
              .from('meeting_room_bookings')
              .select(`
                *,
                tenants(name, company_name),
                office_spaces(space_number)
              `)
              .eq('id', bookingId)
              .single();

            if (newBooking) {
              setAllBookings(prev => {
                const sorted = [newBooking, ...prev].sort((a, b) => {
                  const companyA = a.tenants?.company_name || a.tenants?.name || '';
                  const companyB = b.tenants?.company_name || b.tenants?.name || '';
                  const companyCompare = companyA.localeCompare(companyB);
                  if (companyCompare !== 0) return companyCompare;
                  const dateCompare = a.booking_date.localeCompare(b.booking_date);
                  if (dateCompare !== 0) return dateCompare;
                  return a.start_time.localeCompare(b.start_time);
                });
                return sorted;
              });
              applyFilter([newBooking, ...allBookings], selectedFilter);
            }
          } else if (action === 'updated') {
            // Fetch updated booking and update in lists
            const { data: updatedBooking } = await supabase
              .from('meeting_room_bookings')
              .select(`
                *,
                tenants(name, company_name),
                office_spaces(space_number)
              `)
              .eq('id', bookingId)
              .single();

            if (updatedBooking) {
              setBookings(prev => prev.map(b => b.id === bookingId ? updatedBooking : b));
              setAllBookings(prev => prev.map(b => b.id === bookingId ? updatedBooking : b));
            }
          }
        }} />
        </div>
      ) : (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-dark-800 border-b border-amber-500">
            <h2 className="text-lg font-bold text-gray-100">
              Vergaderruimte Boekingen
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedFilter('all');
                  applyFilter(allBookings, 'all');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                  selectedFilter === 'all'
                    ? 'bg-gold-600 text-white'
                    : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                }`}
              >
                Alle
              </button>
              <button
                onClick={() => {
                  setSelectedFilter('internal');
                  applyFilter(allBookings, 'internal');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                  selectedFilter === 'internal'
                    ? 'bg-gold-600 text-white'
                    : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                }`}
              >
                Intern
              </button>
              <button
                onClick={() => {
                  setSelectedFilter('external');
                  applyFilter(allBookings, 'external');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                  selectedFilter === 'external'
                    ? 'bg-gold-600 text-white'
                    : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                }`}
              >
                Extern
              </button>
              <button
                onClick={() => {
                  setSelectedFilter('upcoming');
                  applyFilter(allBookings, 'upcoming');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                  selectedFilter === 'upcoming'
                    ? 'bg-gold-600 text-white'
                    : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                }`}
              >
                Aankomend
              </button>
              <button
                onClick={() => {
                  setSelectedFilter('invoiced');
                  applyFilter(allBookings, 'invoiced');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                  selectedFilter === 'invoiced'
                    ? 'bg-gold-600 text-white'
                    : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                }`}
              >
                Gefactureerd
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[1000px]">
            <thead>
              <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                <th className="text-left px-4 py-3 font-semibold w-[16%]">
                  Datum & Tijd
                </th>
                <th className="text-left px-4 py-3 font-semibold w-[10%]">
                  Ruimte
                </th>
                <th className="text-left px-4 py-3 font-semibold w-[18%]">
                  Klant
                </th>
                <th className="text-left px-4 py-3 font-semibold w-[12%]">
                  Duur
                </th>
                <th className="text-left px-4 py-3 font-semibold w-[10%]">
                  Bedrag
                </th>
                <th className="text-left px-4 py-3 font-semibold w-[10%]">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-semibold w-[12%]">
                  Factuur
                </th>
                <th className="text-center px-4 py-3 font-semibold w-[12%]">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <div className="flex flex-col items-center">
                      <CheckCircle size={48} className="text-green-500 mb-4" />
                      <p className="text-gray-400">Geen boekingen gevonden</p>
                    </div>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-dark-800/50 transition-colors">
                    <td className="px-4 py-3 w-[16%]">
                      <div className="text-sm text-gray-200 font-medium">
                        Week {getWeekNumber(new Date(booking.booking_date + 'T00:00:00'))} - {new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-[10%]">
                      <div className="text-sm font-medium text-gray-200">
                        {booking.office_spaces?.space_number}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-[18%]">
                      {booking.booking_type === 'external' ? (
                        <>
                          <div className="text-sm text-gray-200">{booking.external_customers?.contact_name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{booking.external_customers?.company_name}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm text-gray-200">{booking.tenants?.name}</div>
                          {booking.tenants?.company_name && (
                            <div className="text-xs text-gray-400 mt-0.5">{booking.tenants.company_name}</div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 w-[12%]">
                      <div className="text-sm text-gray-200">
                        {booking.total_hours.toFixed(1)} uur
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        €{booking.hourly_rate}/uur
                      </div>
                    </td>
                    <td className="px-4 py-3 w-[10%]">
                      <div className="text-sm font-semibold text-gray-200">
                        €{booking.total_amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-[10%]">
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
                    <td className="px-4 py-3 w-[12%]">
                      <div className="flex items-center justify-center">
                        {booking.invoice_id ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-green-900/50 text-green-300 border border-green-700/50">
                            <Check size={14} className="mr-1" />
                            Ja
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-gray-800/50 text-gray-400 border border-gray-700/50">
                            <X size={14} className="mr-1" />
                            Nee
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-[12%]">
                      <div className="flex items-center justify-center gap-2">
                        {!loggedInTenantId && !booking.invoice_id && booking.status === 'completed' && (
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
                        {!loggedInTenantId && booking.status === 'confirmed' && (
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
                          onClick={() => confirmDelete(booking.id)}
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

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md my-8 mx-4 border border-dark-700">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Boeking verwijderen</h3>
            <p className="text-gray-300 mb-4">
              Weet je zeker dat je deze boeking wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-dark-700 text-gray-200 rounded-lg hover:bg-dark-600 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
