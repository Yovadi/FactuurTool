import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, Plus, X, Check, AlertCircle, Trash2, CalendarDays, FileText, CheckCircle, XCircle, Info, RotateCcw, Filter } from 'lucide-react';
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
};

type MeetingRoomRates = {
  hourly_rate: number;
  half_day_rate: number | null;
  full_day_rate: number | null;
  vat_inclusive: boolean;
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
  discount_percentage?: number;
  discount_amount?: number;
  rate_type?: 'hourly' | 'half_day' | 'full_day';
  applied_rate?: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
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
  const [selectedView, setSelectedView] = useState<'list' | 'calendar'>('list');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'internal' | 'external' | 'upcoming' | 'invoiced'>('all');
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>('all');
  const [selectedTab, setSelectedTab] = useState<'tenant' | 'external'>('tenant');
  const [bookingType, setBookingType] = useState<'tenant' | 'external'>('tenant');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationId, setNotificationId] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [meetingRoomRates, setMeetingRoomRates] = useState<MeetingRoomRates>({
    hourly_rate: 0,
    half_day_rate: null,
    full_day_rate: null,
    vat_inclusive: false
  });

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
    console.log('MeetingRoomBookings component mounted, loading data...');
    loadData();
  }, []);

  useEffect(() => {
    console.log('Meeting room rates state updated:', meetingRoomRates);
  }, [meetingRoomRates]);

  const loadData = async () => {
    setLoading(true);

    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('id, name, company_name, meeting_discount_percentage')
      .order('name');
    console.log('Loaded tenants:', tenantsData);

    const { data: externalCustomersData } = await supabase
      .from('external_customers')
      .select('id, company_name, contact_name, email, phone, street, postal_code, city, country, meeting_discount_percentage')
      .order('company_name');
    console.log('Loaded external customers:', externalCustomersData);

    const { data: spacesData } = await supabase
      .from('office_spaces')
      .select('id, space_number')
      .eq('space_type', 'Meeting Room')
      .order('space_number');

    const { data: ratesData } = await supabase
      .from('space_type_rates')
      .select('hourly_rate, half_day_rate, full_day_rate, vat_inclusive')
      .eq('space_type', 'Meeting Room')
      .maybeSingle();

    console.log('Raw rates data from DB:', ratesData);

    if (ratesData) {
      const convertedRates = {
        hourly_rate: Number(ratesData.hourly_rate) || 0,
        half_day_rate: ratesData.half_day_rate ? Number(ratesData.half_day_rate) : null,
        full_day_rate: ratesData.full_day_rate ? Number(ratesData.full_day_rate) : null,
        vat_inclusive: ratesData.vat_inclusive || false
      };
      console.log('Converted rates:', convertedRates);
      console.log('Types:', {
        hourly: typeof convertedRates.hourly_rate,
        halfDay: typeof convertedRates.half_day_rate,
        fullDay: typeof convertedRates.full_day_rate
      });
      setMeetingRoomRates(convertedRates);
    }

    let bookingsQuery = supabase
      .from('meeting_room_bookings')
      .select(`
        *,
        tenants(name, company_name),
        external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country),
        office_spaces(space_number)
      `)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (loggedInTenantId) {
      bookingsQuery = bookingsQuery.eq('tenant_id', loggedInTenantId);
    }

    const { data: bookingsData } = await bookingsQuery;

    const sortedBookings = (bookingsData || []).sort((a, b) => {
      const dateCompare = b.booking_date.localeCompare(a.booking_date);
      if (dateCompare !== 0) return dateCompare;

      return b.start_time.localeCompare(a.start_time);
    });

    setTenants(tenantsData || []);
    setExternalCustomers(externalCustomersData || []);
    setMeetingRooms(spacesData || []);
    setAllBookings(sortedBookings);
    applyFilter(sortedBookings, selectedFilter);
    setLoading(false);
  };

  const applyFilter = (bookingsList: Booking[], filter: 'all' | 'internal' | 'external' | 'upcoming' | 'invoiced', tenantFilter?: string) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let filtered = bookingsList;

    if (filter === 'all') {
      filtered = bookingsList;
    } else if (filter === 'internal') {
      filtered = bookingsList.filter(b => b.booking_type === 'tenant');
    } else if (filter === 'external') {
      filtered = bookingsList.filter(b => b.booking_type === 'external');
    } else if (filter === 'upcoming') {
      filtered = bookingsList.filter(b => b.booking_date >= todayStr && !b.invoice_id);
    } else if (filter === 'invoiced') {
      filtered = bookingsList.filter(b => b.invoice_id !== null);
    }

    const currentTenantFilter = tenantFilter !== undefined ? tenantFilter : selectedTenantFilter;
    if (currentTenantFilter !== 'all') {
      filtered = filtered.filter(b => {
        if (b.booking_type === 'tenant') {
          return b.tenant_id === currentTenantFilter;
        } else {
          return b.external_customer_id === currentTenantFilter;
        }
      });
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
    applyFilter(allBookings, selectedFilter);
  };

  const handleTenantFilterChange = (tenantId: string) => {
    setSelectedTenantFilter(tenantId);
    applyFilter(allBookings, selectedFilter, tenantId);
  };

  const calculateTotalHours = (startTime: string, endTime: string) => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60);
  };

  const calculateOptimalRate = (
    totalHours: number,
    hourlyRate: number,
    halfDayRate?: number,
    fullDayRate?: number
  ): { rateType: 'hourly' | 'half_day' | 'full_day'; appliedRate: number; totalAmount: number } => {
    const hourlyTotal = totalHours * hourlyRate;

    console.log('calculateOptimalRate input:', {
      totalHours,
      hourlyRate,
      halfDayRate,
      fullDayRate,
      hourlyTotal,
      types: {
        totalHours: typeof totalHours,
        hourlyRate: typeof hourlyRate,
        halfDayRate: typeof halfDayRate,
        fullDayRate: typeof fullDayRate
      }
    });

    if (totalHours >= 8 && fullDayRate && fullDayRate < hourlyTotal) {
      console.log('Using full day rate:', fullDayRate, '<', hourlyTotal);
      return { rateType: 'full_day', appliedRate: fullDayRate, totalAmount: fullDayRate };
    }

    if (totalHours >= 4 && halfDayRate && halfDayRate < hourlyTotal) {
      if (fullDayRate && totalHours >= 8 && fullDayRate < halfDayRate) {
        console.log('Using full day rate (via half day check):', fullDayRate, '<', halfDayRate);
        return { rateType: 'full_day', appliedRate: fullDayRate, totalAmount: fullDayRate };
      }
      console.log('Using half day rate:', halfDayRate, '<', hourlyTotal);
      return { rateType: 'half_day', appliedRate: halfDayRate, totalAmount: halfDayRate };
    }

    console.log('Using hourly rate');
    return { rateType: 'hourly', appliedRate: hourlyRate, totalAmount: hourlyTotal };
  };

  const getRateLabel = (rateType: 'hourly' | 'half_day' | 'full_day') => {
    switch (rateType) {
      case 'hourly': return 'Uurtarief';
      case 'half_day': return 'Dagdeeltarief';
      case 'full_day': return 'Hele dag tarief';
    }
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
    console.log('Booking calculation - Hours:', totalHours, 'Rates:', {
      hourly: meetingRoomRates.hourly_rate,
      halfDay: meetingRoomRates.half_day_rate,
      fullDay: meetingRoomRates.full_day_rate
    });
    const { rateType, appliedRate, totalAmount } = calculateOptimalRate(
      totalHours,
      meetingRoomRates.hourly_rate || formData.hourly_rate,
      meetingRoomRates.half_day_rate || undefined,
      meetingRoomRates.full_day_rate || undefined
    );
    console.log('Optimal rate result:', { rateType, appliedRate, totalAmount });

    let discountPercentage = 0;
    if (bookingType === 'tenant') {
      const tenantId = loggedInTenantId || formData.tenant_id;
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('meeting_discount_percentage')
        .eq('id', tenantId)
        .single();
      discountPercentage = Number(tenantData?.meeting_discount_percentage) || 0;
      console.log('Tenant discount percentage:', discountPercentage, 'from data:', tenantData);
    } else {
      const { data: customerData } = await supabase
        .from('external_customers')
        .select('meeting_discount_percentage')
        .eq('id', formData.external_customer_id)
        .single();
      discountPercentage = Number(customerData?.meeting_discount_percentage) || 0;
      console.log('Customer discount percentage:', discountPercentage, 'from data:', customerData);
    }
    const discountAmount = (totalAmount * discountPercentage) / 100;
    const finalAmount = totalAmount - discountAmount;
    console.log('Booking calculation - Total:', totalAmount, 'Discount%:', discountPercentage, 'Discount amount:', discountAmount, 'Final:', finalAmount);

    const insertData: any = {
      space_id: formData.space_id,
      booking_date: formData.booking_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      hourly_rate: meetingRoomRates.hourly_rate || formData.hourly_rate,
      total_hours: totalHours,
      total_amount: finalAmount,
      discount_percentage: discountPercentage,
      discount_amount: discountAmount,
      rate_type: rateType,
      applied_rate: appliedRate,
      status: 'confirmed',
      notes: formData.notes,
      booking_type: bookingType
    };

    if (bookingType === 'tenant') {
      const tenantId = loggedInTenantId || formData.tenant_id;
      insertData.tenant_id = tenantId || null;
      insertData.external_customer_id = null;
    } else {
      insertData.tenant_id = null;
      insertData.external_customer_id = formData.external_customer_id || null;
    }

    console.log('Insert data:', JSON.stringify(insertData, null, 2));

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
      const updatedAllBookings = [data, ...allBookings].sort((a, b) => {
        const dateCompare = b.booking_date.localeCompare(a.booking_date);
        if (dateCompare !== 0) return dateCompare;
        return b.start_time.localeCompare(a.start_time);
      });
      setAllBookings(updatedAllBookings);
      applyFilter(updatedAllBookings, selectedFilter);
    }

    showNotification('Boeking succesvol aangemaakt!', 'success');
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
    let rateDescription = '';
    if (booking.rate_type === 'half_day') {
      rateDescription = `dagdeel tarief €${(booking.applied_rate || 0).toFixed(2)}`;
    } else if (booking.rate_type === 'full_day') {
      rateDescription = `hele dag tarief €${(booking.applied_rate || 0).toFixed(2)}`;
    } else {
      const hourlyRate = booking.applied_rate || (booking.hourly_rate || 0);
      rateDescription = `${booking.total_hours}u × €${hourlyRate.toFixed(2)}`;
    }

    // Calculate original amount (before discount)
    const originalAmount = booking.total_amount + (booking.discount_amount || 0);

    // Create booking line without discount note (show original amount)
    const bookingLine = `- ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)} (${rateDescription}) = €${originalAmount.toFixed(2)}`;

    // Create discount line if applicable
    const hasDiscount = booking.discount_percentage && booking.discount_percentage > 0 && booking.discount_amount && booking.discount_amount > 0;
    const discountLine = hasDiscount
      ? `- Korting ${booking.discount_percentage}% huurderkorting = €${booking.discount_amount.toFixed(2)}`
      : '';

    let updatedNotes = invoice.notes || '';
    const lines = updatedNotes.split('\n');
    // Filter out both the booking line and the discount line
    const filteredLines = lines.filter(line => {
      const trimmedLine = line.trim();
      return trimmedLine !== bookingLine.trim() && trimmedLine !== discountLine.trim();
    });
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
    const vatInclusive = meetingRoomRates.vat_inclusive;

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

    let rateDescription = '';
    if (booking.rate_type === 'half_day') {
      rateDescription = `dagdeel tarief €${(booking.applied_rate || 0).toFixed(2)}`;
    } else if (booking.rate_type === 'full_day') {
      rateDescription = `hele dag tarief €${(booking.applied_rate || 0).toFixed(2)}`;
    } else {
      const hourlyRate = booking.applied_rate || (booking.hourly_rate || 0);
      rateDescription = `${booking.total_hours}u × €${hourlyRate.toFixed(2)}`;
    }

    // Calculate original amount (before discount)
    const originalAmount = booking.total_amount + (booking.discount_amount || 0);

    // Create booking line without discount note (show original amount)
    const bookingLine = `- ${new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)} (${rateDescription}) = €${originalAmount.toFixed(2)}`;

    // Create discount line if applicable
    const hasDiscount = booking.discount_percentage && booking.discount_percentage > 0 && booking.discount_amount && booking.discount_amount > 0;
    const discountLine = hasDiscount
      ? `- Korting ${booking.discount_percentage}% huurderkorting = €${booking.discount_amount.toFixed(2)}`
      : '';

    if (existingInvoice) {
      let bookingSubtotal: number;
      if (vatInclusive) {
        bookingSubtotal = booking.total_amount / (1 + vatRate / 100);
      } else {
        bookingSubtotal = booking.total_amount;
      }
      const newSubtotal = parseFloat(existingInvoice.subtotal) + bookingSubtotal;
      const newVatAmount = newSubtotal * (vatRate / 100);
      const newTotal = newSubtotal + newVatAmount;

      let updatedNotes = existingInvoice.notes ? `${existingInvoice.notes}\n${bookingLine}` : `Vergaderruimte boekingen:\n${bookingLine}`;
      if (hasDiscount) {
        updatedNotes += `\n${discountLine}`;
      }

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

      let subtotal: number;
      if (vatInclusive) {
        subtotal = booking.total_amount / (1 + vatRate / 100);
      } else {
        subtotal = booking.total_amount;
      }
      const vatAmount = subtotal * (vatRate / 100);
      const totalAmount = subtotal + vatAmount;

      const { data: invoiceNumberResult, error: rpcError } = await supabase
        .rpc('generate_invoice_number');

      if (rpcError) {
        console.error('Error generating invoice number:', rpcError);
        throw new Error('Fout bij het genereren van factuurnummer');
      }

      const invoiceNumber = invoiceNumberResult || 'INV-ERROR';

      let notes = `Vergaderruimte boekingen:\n${bookingLine}`;
      if (hasDiscount) {
        notes += `\n${discountLine}`;
      }

      const invoiceInsertData: any = {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDateStr,
        invoice_month: invoiceMonth,
        status: 'draft',
        subtotal: subtotal,
        vat_amount: vatAmount,
        vat_rate: vatRate,
        vat_inclusive: vatInclusive,
        amount: totalAmount,
        notes: notes
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
    setFormData({
      ...formData,
      space_id: spaceId,
      hourly_rate: meetingRoomRates.hourly_rate || 25
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

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 mb-4">Vergaderruimte Boekingen</h1>
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedView('list')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                selectedView === 'list'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <AlertCircle size={18} />
              Lijst
            </button>
            <button
              onClick={() => setSelectedView('calendar')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                selectedView === 'calendar'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <CalendarDays size={18} />
              Kalender
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-2xl my-8 mx-4 border border-dark-700">
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
                        {Array.from({ length: 10 }, (_, i) => {
                          const hour = i + 8;
                          const time = `${String(hour).padStart(2, '0')}:00`;
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
                        {Array.from({ length: 10 }, (_, i) => {
                          const hour = i + 8;
                          const time = `${String(hour).padStart(2, '0')}:00`;
                          return (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const totalHours = calculateTotalHours(formData.start_time, formData.end_time);
                    const hasRates = meetingRoomRates.hourly_rate > 0;
                    console.log('Form preview calculation:', {
                      totalHours,
                      hasRates,
                      meetingRoomRates: {
                        hourly: meetingRoomRates.hourly_rate,
                        halfDay: meetingRoomRates.half_day_rate,
                        fullDay: meetingRoomRates.full_day_rate
                      }
                    });
                    const rateInfo = hasRates ? calculateOptimalRate(
                      totalHours,
                      meetingRoomRates.hourly_rate,
                      meetingRoomRates.half_day_rate || undefined,
                      meetingRoomRates.full_day_rate || undefined
                    ) : { rateType: 'hourly' as const, appliedRate: 25, totalAmount: totalHours * 25 };

                    let discountPercentage = 0;
                    if (bookingType === 'tenant') {
                      const tenantId = loggedInTenantId || formData.tenant_id;
                      const selectedTenant = tenants.find(t => t.id === tenantId);
                      discountPercentage = Number(selectedTenant?.meeting_discount_percentage) || 0;
                      console.log('Preview - Tenant:', selectedTenant?.name, 'Discount:', discountPercentage, 'Full tenant data:', selectedTenant);
                    } else {
                      const selectedCustomer = externalCustomers.find(c => c.id === formData.external_customer_id);
                      discountPercentage = Number(selectedCustomer?.meeting_discount_percentage) || 0;
                      console.log('Preview - Customer:', selectedCustomer?.company_name, 'Discount:', discountPercentage, 'Full customer data:', selectedCustomer);
                    }
                    const discountAmount = (rateInfo.totalAmount * discountPercentage) / 100;
                    const finalAmount = rateInfo.totalAmount - discountAmount;

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className={`p-3 rounded-lg border ${rateInfo.rateType === 'hourly' ? 'border-gold-500 bg-gold-500/10' : 'border-dark-600 bg-dark-800'}`}>
                            <div className="text-xs text-gray-400 mb-1">Uurtarief</div>
                            <div className="text-sm font-medium text-gray-100">
                              {meetingRoomRates.hourly_rate ? `€${meetingRoomRates.hourly_rate}/uur` : '-'}
                            </div>
                          </div>
                          <div className={`p-3 rounded-lg border ${rateInfo.rateType === 'half_day' ? 'border-gold-500 bg-gold-500/10' : 'border-dark-600 bg-dark-800'}`}>
                            <div className="text-xs text-gray-400 mb-1">Dagdeel (4+ uur)</div>
                            <div className="text-sm font-medium text-gray-100">
                              {meetingRoomRates.half_day_rate ? `€${meetingRoomRates.half_day_rate}` : '-'}
                            </div>
                          </div>
                          <div className={`p-3 rounded-lg border ${rateInfo.rateType === 'full_day' ? 'border-gold-500 bg-gold-500/10' : 'border-dark-600 bg-dark-800'}`}>
                            <div className="text-xs text-gray-400 mb-1">Hele dag (8+ uur)</div>
                            <div className="text-sm font-medium text-gray-100">
                              {meetingRoomRates.full_day_rate ? `€${meetingRoomRates.full_day_rate}` : '-'}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 bg-dark-700 rounded-lg border border-gold-500">
                            <div>
                              <span className="text-sm text-gray-400">Toegepast tarief: </span>
                              <span className="text-sm font-medium text-gold-400">{getRateLabel(rateInfo.rateType)}</span>
                              <span className="text-sm text-gray-400"> ({totalHours} uur)</span>
                              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${meetingRoomRates.vat_inclusive ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {meetingRoomRates.vat_inclusive ? 'incl. BTW' : 'excl. BTW'}
                              </span>
                            </div>
                            <div className="text-lg font-semibold text-gold-400">
                              €{finalAmount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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

      {selectedView === 'calendar' ? (
        <div>
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
                external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country),
                office_spaces(space_number)
              `)
              .eq('id', bookingId)
              .single();

            if (newBooking) {
              setAllBookings(prev => {
                const sorted = [newBooking, ...prev].sort((a, b) => {
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
                external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country),
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <select
                  value={selectedTenantFilter}
                  onChange={(e) => handleTenantFilterChange(e.target.value)}
                  className="px-3 py-1.5 bg-dark-700 border border-dark-600 text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <option value="all">Alle klanten</option>
                  <optgroup label="Huurders">
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.company_name || tenant.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Externe klanten">
                    {externalCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
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
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full table-fixed min-w-[1000px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                <th className="text-left px-4 py-3 font-semibold w-[14%]">
                  Datum & Tijd
                </th>
                <th className="text-left px-4 py-3 font-semibold w-[9%]">
                  Ruimte
                </th>
                <th className="text-left px-4 py-3 font-semibold w-[15%]">
                  Klant
                </th>
                <th className="text-left px-4 py-3 font-semibold w-[10%]">
                  Duur
                </th>
                <th className="text-left px-4 py-3 font-semibold w-[9%]">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-semibold w-[10%]">
                  Factuur
                </th>
                <th className="text-center px-4 py-3 font-semibold w-[24%]">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <div className="flex flex-col items-center">
                      <CheckCircle size={48} className="text-green-500 mb-4" />
                      <p className="text-gray-400">Geen boekingen gevonden</p>
                    </div>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className={`hover:bg-dark-800/50 transition-colors ${
                      booking.status === 'cancelled'
                        ? 'opacity-50 bg-red-900/10'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3 w-[14%]">
                      <div className="text-sm text-gray-200 font-medium">
                        Week {getWeekNumber(new Date(booking.booking_date + 'T00:00:00'))} - {new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-[9%]">
                      <div className="text-sm font-medium text-gray-200">
                        {booking.office_spaces?.space_number}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-[15%]">
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
                    <td className="px-4 py-3 w-[10%]">
                      <div className="text-sm text-gray-200">
                        {booking.total_hours.toFixed(1)} uur
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {booking.rate_type ? getRateLabel(booking.rate_type) : `€${booking.hourly_rate}/uur`}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-[9%]">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                          booking.status === 'pending'
                            ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50'
                            : booking.status === 'confirmed'
                            ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
                            : booking.status === 'completed'
                            ? 'bg-green-900/50 text-green-300 border border-green-700/50'
                            : 'bg-red-900/50 text-red-300 border border-red-700/50'
                        }`}
                      >
                        {booking.status === 'pending'
                          ? 'In afwachting'
                          : booking.status === 'confirmed'
                          ? 'Bevestigd'
                          : booking.status === 'completed'
                          ? 'Voltooid'
                          : 'Geannuleerd'}
                      </span>
                    </td>
                    <td className="px-4 py-3 w-[10%]">
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
                    <td className="px-4 py-3 w-[24%]">
                      <div className="flex items-center justify-center gap-3">
                        {!loggedInTenantId && booking.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'confirmed')}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            title="Bevestig boeking"
                          >
                            <CheckCircle size={20} />
                          </button>
                        )}
                        {!loggedInTenantId && booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'completed')}
                            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            title="Markeer als voltooid"
                          >
                            <Check size={20} />
                          </button>
                        )}
                        {!loggedInTenantId && booking.status === 'completed' && !booking.invoice_id && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'confirmed')}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            title="Zet terug naar bevestigd"
                          >
                            <RotateCcw size={20} />
                          </button>
                        )}
                        {(booking.status === 'pending' || booking.status === 'confirmed') && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'cancelled')}
                            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            title="Annuleer boeking"
                          >
                            <AlertCircle size={20} />
                          </button>
                        )}
                        <button
                          onClick={() => confirmDelete(booking.id)}
                          className="p-2 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-lg transition-colors"
                          title="Verwijder boeking"
                        >
                          <Trash2 size={20} />
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
