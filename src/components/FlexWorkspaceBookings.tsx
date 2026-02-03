import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Plus, X, Check, AlertCircle, Trash2, CalendarDays, CheckCircle, XCircle, Info, Filter, Building2, ChevronLeft, ChevronRight, Grid3x3, User } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

type Notification = {
  id: number;
  message: string;
  type: NotificationType;
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

type Tenant = {
  id: string;
  company_name: string;
  contact_name: string;
};

type FlexSpace = {
  id: string;
  space_number: string;
  flex_capacity: number | null;
};

type FlexBooking = {
  id: string;
  space_id: string;
  external_customer_id: string;
  booking_date: string;
  slot_number: number | null;
  is_half_day: boolean;
  half_day_period?: 'morning' | 'afternoon';
  start_time?: string;
  end_time?: string;
  hourly_rate: number;
  total_hours: number;
  total_amount: number;
  invoice_id: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  office_spaces?: { space_number: string };
  external_customers?: ExternalCustomer;
};

type FlexSchedule = {
  id: string;
  space_id: string;
  lease_id: string | null;
  external_customer_id: string | null;
  slot_number: number | null;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  office_spaces?: { space_number: string };
  external_customers?: ExternalCustomer;
  leases?: {
    tenant_id: string;
    tenants?: Tenant;
  };
};

type CalendarDay = {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  bookings: FlexBooking[];
  schedules: FlexSchedule[];
};

type SlotBooking = {
  type: 'booking' | 'schedule';
  customerName: string;
  customerId: string;
  bookingId?: string;
  scheduleId?: string;
  isInvoiced?: boolean;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  time?: string;
  isHalfDay?: boolean;
  halfDayPeriod?: 'morning' | 'afternoon';
  startTime?: string;
  endTime?: string;
  totalHours?: number;
};

type TimeSegment = {
  startHour: number;
  endHour: number;
  booking: SlotBooking | null;
  isAvailable: boolean;
};

export function FlexWorkspaceBookings() {
  const [bookings, setBookings] = useState<FlexBooking[]>([]);
  const [allBookings, setAllBookings] = useState<FlexBooking[]>([]);
  const [schedules, setSchedules] = useState<FlexSchedule[]>([]);
  const [flexSpaces, setFlexSpaces] = useState<FlexSpace[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<ExternalCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedView, setSelectedView] = useState<'list' | 'calendar' | 'resource'>('resource');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'upcoming' | 'invoiced'>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationId, setNotificationId] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [showQuickBooking, setShowQuickBooking] = useState(false);
  const [quickBookingDate, setQuickBookingDate] = useState('');
  const [quickBookingSlot, setQuickBookingSlot] = useState<number | null>(null);
  const [selectedResourceSpace, setSelectedResourceSpace] = useState<string>('');
  const [quickFormData, setQuickFormData] = useState({
    space_id: '',
    external_customer_id: '',
    start_time: '09:00',
    end_time: '17:00'
  });

  const [formData, setFormData] = useState({
    space_id: '',
    external_customer_id: '',
    booking_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '17:00'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [selectedFilter, allBookings]);

  useEffect(() => {
    if (selectedView === 'calendar') {
      generateCalendar();
    }
  }, [currentDate, allBookings, schedules, selectedView]);

  useEffect(() => {
    if (flexSpaces.length > 0 && !selectedResourceSpace) {
      setSelectedResourceSpace(flexSpaces[0].id);
    }
  }, [flexSpaces]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bookingsRes, schedulesRes, spacesRes, customersRes] = await Promise.all([
        supabase
          .from('flex_day_bookings')
          .select(`
            *,
            office_spaces(space_number),
            external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country)
          `)
          .not('external_customer_id', 'is', null)
          .order('booking_date', { ascending: false }),
        supabase
          .from('flex_schedules')
          .select(`
            *,
            office_spaces(space_number),
            external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country),
            leases(tenant_id, tenants(id, company_name, contact_name))
          `),
        supabase
          .from('office_spaces')
          .select('id, space_number, flex_capacity, space_type')
          .eq('space_type', 'Flexplek')
          .eq('is_available', true)
          .order('space_number'),
        supabase
          .from('external_customers')
          .select('*')
          .order('company_name')
      ]);

      if (bookingsRes.data) {
        setAllBookings(bookingsRes.data as FlexBooking[]);
        setBookings(bookingsRes.data as FlexBooking[]);
      }
      if (schedulesRes.data) setSchedules(schedulesRes.data as FlexSchedule[]);
      if (spacesRes.data) setFlexSpaces(spacesRes.data);
      if (customersRes.data) setExternalCustomers(customersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Fout bij laden van gegevens', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let dayOfWeek = firstDay.getDay();
    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const days: CalendarDay[] = [];

    for (let i = 0; i < dayOfWeek; i++) {
      const date = new Date(year, month, -dayOfWeek + i + 1);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        dateStr,
        isCurrentMonth: false,
        bookings: allBookings.filter(b => b.booking_date === dateStr),
        schedules: getSchedulesForDate(date)
      });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        dateStr,
        isCurrentMonth: true,
        bookings: allBookings.filter(b => b.booking_date === dateStr),
        schedules: getSchedulesForDate(date)
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        dateStr,
        isCurrentMonth: false,
        bookings: allBookings.filter(b => b.booking_date === dateStr),
        schedules: getSchedulesForDate(date)
      });
    }

    setCalendarDays(days);
  };

  const getSchedulesForDate = (date: Date): FlexSchedule[] => {
    const dayOfWeek = date.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek] as keyof FlexSchedule;

    return schedules.filter(schedule => {
      const dayValue = schedule[dayName];
      return typeof dayValue === 'boolean' && dayValue === true;
    });
  };

  const applyFilters = () => {
    let filtered = [...allBookings];

    switch (selectedFilter) {
      case 'upcoming':
        const today = new Date().toISOString().split('T')[0];
        filtered = filtered.filter(b => b.booking_date >= today);
        break;
      case 'invoiced':
        filtered = filtered.filter(b => b.invoice_id !== null);
        break;
    }

    setBookings(filtered);
  };

  const showNotification = (message: string, type: NotificationType) => {
    const id = notificationId + 1;
    setNotificationId(id);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.space_id) {
      showNotification('Selecteer een flexruimte', 'error');
      return;
    }

    if (!formData.external_customer_id) {
      showNotification('Selecteer een externe klant', 'error');
      return;
    }

    try {
      const { data: availableSlotsData } = await supabase
        .rpc('get_available_flex_slots', {
          p_space_id: formData.space_id,
          p_booking_date: formData.booking_date
        });

      if (!availableSlotsData || availableSlotsData.length === 0) {
        showNotification('Geen beschikbare plekken voor deze datum', 'error');
        return;
      }

      const firstAvailableSlot = availableSlotsData[0];

      const { data: spaceData } = await supabase
        .from('office_spaces')
        .select('hourly_rate, half_day_rate, full_day_rate')
        .eq('id', formData.space_id)
        .single();

      if (!spaceData) {
        showNotification('Ruimte tarieven niet gevonden', 'error');
        return;
      }

      const calculation = calculateRateAndAmount(
        formData.start_time,
        formData.end_time,
        {
          hourly_rate: Number(spaceData.hourly_rate) || 0,
          half_day_rate: Number(spaceData.half_day_rate) || 0,
          full_day_rate: Number(spaceData.full_day_rate) || 0
        }
      );

      if (calculation.totalHours <= 0) {
        showNotification('Eindtijd moet na starttijd zijn', 'error');
        return;
      }

      const bookingData: any = {
        space_id: formData.space_id,
        external_customer_id: formData.external_customer_id,
        booking_date: formData.booking_date,
        slot_number: firstAvailableSlot,
        start_time: formData.start_time,
        end_time: formData.end_time,
        hourly_rate: Number(spaceData.hourly_rate) || 0,
        total_hours: calculation.totalHours,
        total_amount: calculation.totalAmount,
        is_half_day: calculation.isHalfDay,
        half_day_period: calculation.halfDayPeriod
      };

      const { data, error } = await supabase
        .from('flex_day_bookings')
        .insert([bookingData])
        .select(`
          *,
          office_spaces(space_number),
          external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country)
        `)
        .single();

      if (error) throw error;

      if (data) {
        setAllBookings(prev => [data as FlexBooking, ...prev]);
        const rateTypeText = calculation.rateUsed === 'hourly' ? 'uurtarief' : calculation.rateUsed === 'half_day' ? 'halve dag tarief' : 'hele dag tarief';
        showNotification(`Flexplekboeking aangemaakt op Plek ${firstAvailableSlot} (${rateTypeText})`, 'success');
        setShowForm(false);
        resetForm();
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      const message = error.message?.includes('unique_flex_slot_booking')
        ? 'Deze plek is al geboekt voor deze datum'
        : error.message?.includes('flex_day_bookings_customer_check')
        ? 'Externe klant is verplicht voor flexplekken'
        : 'Fout bij aanmaken boeking';
      showNotification(message, 'error');
    }
  };

  const handleStatusChange = async (bookingId: string, newStatus: 'confirmed' | 'cancelled' | 'completed') => {
    const booking = allBookings.find(b => b.id === bookingId);

    if (!booking) {
      showNotification('Boeking niet gevonden.', 'error');
      return;
    }

    if (newStatus === 'cancelled' && booking.invoice_id) {
      showNotification('Kan gefactureerde boeking niet annuleren.', 'error');
      return;
    }

    const { error } = await supabase
      .from('flex_day_bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating status:', error.message);
      showNotification('Fout bij het bijwerken van de status.', 'error');
      return;
    }

    setAllBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, status: newStatus } : b))
    );

    const statusText = newStatus === 'confirmed' ? 'geaccepteerd' : newStatus === 'cancelled' ? 'geannuleerd' : 'voltooid';
    showNotification(`Boeking is ${statusText}.`, 'success');
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      const { error } = await supabase
        .from('flex_day_bookings')
        .delete()
        .eq('id', deleteConfirmId);

      if (error) throw error;

      setAllBookings(prev => prev.filter(b => b.id !== deleteConfirmId));
      showNotification('Boeking verwijderd', 'success');
    } catch (error) {
      console.error('Error deleting booking:', error);
      showNotification('Fout bij verwijderen boeking', 'error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const previousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const resetForm = () => {
    setFormData({
      space_id: '',
      external_customer_id: '',
      booking_date: new Date().toISOString().split('T')[0],
      start_time: '09:00',
      end_time: '17:00'
    });
  };

  const calculateRateAndAmount = (
    startTime: string,
    endTime: string,
    spaceRates: { hourly_rate: number; half_day_rate: number; full_day_rate: number }
  ) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const totalHours = (endHour + endMin / 60) - (startHour + startMin / 60);

    if (totalHours <= 0) {
      return { totalHours: 0, totalAmount: 0, rateUsed: 'none', isHalfDay: false, halfDayPeriod: null };
    }

    const hourlyTotal = totalHours * spaceRates.hourly_rate;

    if (totalHours >= 8 && spaceRates.full_day_rate && spaceRates.full_day_rate < hourlyTotal) {
      return {
        totalHours,
        totalAmount: spaceRates.full_day_rate,
        rateUsed: 'full_day',
        isHalfDay: false,
        halfDayPeriod: null
      };
    }

    if (totalHours >= 4 && spaceRates.half_day_rate && spaceRates.half_day_rate < hourlyTotal) {
      if (spaceRates.full_day_rate && totalHours >= 8 && spaceRates.full_day_rate < spaceRates.half_day_rate) {
        return {
          totalHours,
          totalAmount: spaceRates.full_day_rate,
          rateUsed: 'full_day',
          isHalfDay: false,
          halfDayPeriod: null
        };
      }
      const halfDayPeriod = startHour < 13 ? 'morning' : 'afternoon';
      return {
        totalHours,
        totalAmount: spaceRates.half_day_rate,
        rateUsed: 'half_day',
        isHalfDay: true,
        halfDayPeriod
      };
    }

    return {
      totalHours,
      totalAmount: hourlyTotal,
      rateUsed: 'hourly',
      isHalfDay: false,
      halfDayPeriod: null
    };
  };

  const handleCalendarDayClick = (dateStr: string) => {
    setQuickBookingDate(dateStr);
    setQuickBookingSlot(null);
    setQuickFormData({
      space_id: '',
      external_customer_id: '',
      start_time: '09:00',
      end_time: '17:00'
    });
    setShowQuickBooking(true);
  };

  const handleResourceSlotClick = (dateStr: string, slotNumber: number) => {
    setQuickBookingDate(dateStr);
    setQuickBookingSlot(slotNumber);
    setQuickFormData({
      space_id: selectedResourceSpace,
      external_customer_id: '',
      start_time: '09:00',
      end_time: '17:00'
    });
    setShowQuickBooking(true);
  };

  const handleQuickBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quickFormData.space_id) {
      showNotification('Selecteer een flexruimte', 'error');
      return;
    }

    if (!quickFormData.external_customer_id) {
      showNotification('Selecteer een externe klant', 'error');
      return;
    }

    try {
      let targetSlot = quickBookingSlot;

      if (!targetSlot) {
        const { data: availableSlotsData } = await supabase
          .rpc('get_available_flex_slots', {
            p_space_id: quickFormData.space_id,
            p_booking_date: quickBookingDate
          });

        if (!availableSlotsData || availableSlotsData.length === 0) {
          showNotification('Geen beschikbare plekken voor deze datum', 'error');
          return;
        }

        targetSlot = availableSlotsData[0];
      }

      const { data: spaceData, error: spaceError } = await supabase
        .from('office_spaces')
        .select('hourly_rate, half_day_rate, full_day_rate, is_furnished')
        .eq('id', quickFormData.space_id)
        .single();

      if (spaceError || !spaceData) {
        console.error('Error fetching space data:', spaceError);
        showNotification('Ruimte tarieven niet gevonden', 'error');
        return;
      }

      const hourlyRate = spaceData.hourly_rate || 0;
      const halfDayRate = spaceData.half_day_rate || 0;
      const fullDayRate = spaceData.full_day_rate || 0;

      if (hourlyRate === 0 && halfDayRate === 0 && fullDayRate === 0) {
        showNotification('Deze ruimte heeft geen tarieven ingesteld. Ga naar Producten → Ruimte Tarieven om tarieven in te stellen.', 'error');
        return;
      }

      const calculation = calculateRateAndAmount(
        quickFormData.start_time,
        quickFormData.end_time,
        {
          hourly_rate: hourlyRate,
          half_day_rate: halfDayRate,
          full_day_rate: fullDayRate
        }
      );

      if (calculation.totalHours <= 0) {
        showNotification('Eindtijd moet na starttijd zijn', 'error');
        return;
      }

      if (calculation.totalAmount === 0) {
        showNotification('Kan geen tarief berekenen. Controleer of de tarieven correct zijn ingesteld.', 'error');
        return;
      }

      const bookingData: any = {
        space_id: quickFormData.space_id,
        external_customer_id: quickFormData.external_customer_id,
        booking_date: quickBookingDate,
        slot_number: targetSlot,
        start_time: quickFormData.start_time,
        end_time: quickFormData.end_time,
        hourly_rate: spaceData.hourly_rate || 0,
        total_hours: calculation.totalHours,
        total_amount: calculation.totalAmount,
        is_half_day: calculation.isHalfDay,
        half_day_period: calculation.halfDayPeriod
      };

      const { data, error } = await supabase
        .from('flex_day_bookings')
        .insert([bookingData])
        .select(`
          *,
          office_spaces(space_number),
          external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country)
        `)
        .single();

      if (error) throw error;

      if (data) {
        setAllBookings(prev => [data as FlexBooking, ...prev]);
        const rateTypeText = calculation.rateUsed === 'hourly' ? 'uurtarief' : calculation.rateUsed === 'half_day' ? 'halve dag tarief' : 'hele dag tarief';
        showNotification(`Flexplekboeking aangemaakt op Plek ${targetSlot} (${rateTypeText})`, 'success');
        setShowQuickBooking(false);
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });

      let message = 'Fout bij aanmaken boeking';

      if (error.message?.includes('unique_flex_slot_booking')) {
        message = 'Deze plek is al geboekt voor deze datum';
      } else if (error.message?.includes('flex_day_bookings_customer_check')) {
        message = 'Externe klant is verplicht voor flexplekken';
      } else if (error.message?.includes('booking_date_not_past')) {
        message = 'Kan geen boeking maken in het verleden';
      } else if (error.message?.includes('check_valid_booking_times')) {
        message = 'Eindtijd moet na starttijd liggen';
      } else if (error.message) {
        message = `Fout: ${error.message}`;
      }

      showNotification(message, 'error');
    }
  };

  const getWeekDays = () => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getAllSlotBookings = (slotNumber: number, dateStr: string): SlotBooking[] => {
    const slotBookings: SlotBooking[] = [];

    const dayBookings = allBookings.filter(
      b => b.space_id === selectedResourceSpace &&
           b.slot_number === slotNumber &&
           b.booking_date === dateStr
    );

    dayBookings.forEach(booking => {
      slotBookings.push({
        type: 'booking',
        customerName: booking.external_customers?.company_name || 'Onbekend',
        customerId: booking.external_customer_id,
        bookingId: booking.id,
        isInvoiced: booking.invoice_id !== null,
        status: booking.status,
        time: booking.start_time && booking.end_time ? `${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)}` : undefined,
        isHalfDay: booking.is_half_day,
        halfDayPeriod: booking.half_day_period,
        startTime: booking.start_time,
        endTime: booking.end_time,
        totalHours: booking.total_hours
      });
    });

    if (slotBookings.length === 0) {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek] as keyof FlexSchedule;

      const schedule = schedules.find(
        s => s.space_id === selectedResourceSpace &&
             s.slot_number === slotNumber &&
             typeof s[dayName] === 'boolean' &&
             s[dayName] === true
      );

      if (schedule) {
        const customerName = schedule.external_customers?.company_name ||
                            schedule.leases?.tenants?.company_name ||
                            'Onbekend';
        slotBookings.push({
          type: 'schedule',
          customerName,
          customerId: schedule.external_customer_id || schedule.lease_id || '',
          scheduleId: schedule.id
        });
      }
    }

    return slotBookings;
  };

  const getTimeSegments = (slotNumber: number, dateStr: string): TimeSegment[] => {
    const segments: TimeSegment[] = [];
    const slotBookings = getAllSlotBookings(slotNumber, dateStr);

    if (slotBookings.length === 0 || !slotBookings[0].startTime) {
      return [{
        startHour: 8,
        endHour: 18,
        booking: null,
        isAvailable: true
      }];
    }

    const bookedPeriods: Array<{start: number; end: number; booking: SlotBooking}> = [];

    slotBookings.forEach(booking => {
      if (booking.startTime && booking.endTime) {
        const [startHour, startMin] = booking.startTime.split(':').map(Number);
        const [endHour, endMin] = booking.endTime.split(':').map(Number);
        const start = startHour + startMin / 60;
        const end = endHour + endMin / 60;
        bookedPeriods.push({ start, end, booking });
      }
    });

    bookedPeriods.sort((a, b) => a.start - b.start);

    let currentHour = 8;
    const workdayEnd = 18;

    bookedPeriods.forEach(period => {
      if (currentHour < period.start) {
        segments.push({
          startHour: currentHour,
          endHour: period.start,
          booking: null,
          isAvailable: true
        });
      }

      segments.push({
        startHour: period.start,
        endHour: period.end,
        booking: period.booking,
        isAvailable: false
      });

      currentHour = Math.max(currentHour, period.end);
    });

    if (currentHour < workdayEnd) {
      segments.push({
        startHour: currentHour,
        endHour: workdayEnd,
        booking: null,
        isAvailable: true
      });
    }

    return segments;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('nl-NL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const selectedSpace = flexSpaces.find(s => s.id === selectedResourceSpace);
  const weekDays = getWeekDays();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Flexplek Boekingen</h1>
            <p className="text-sm text-gray-400 mt-1">Beheer externe flexplekboekingen</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors font-medium"
          >
            <Plus size={20} />
            Nieuwe Boeking
          </button>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedView('resource')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                selectedView === 'resource'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <Grid3x3 size={18} />
              Planning
            </button>
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

        {selectedView === 'list' && (
          <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'all', label: 'Alle' },
                  { value: 'upcoming', label: 'Komend' },
                  { value: 'invoiced', label: 'Gefactureerd' }
                ].map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => setSelectedFilter(filter.value as any)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedFilter === filter.value
                        ? 'bg-gold-500 text-white'
                        : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-6 max-w-2xl w-full mx-4 my-8 border border-dark-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-100">Nieuwe Flexplek Boeking</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-dark-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Building2 size={18} className="text-gold-500" />
                  <span className="font-medium">Externe klant boeking</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-6">
                  Flexplekken zijn altijd voor externe klanten
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Flexruimte *
                </label>
                <select
                  value={formData.space_id}
                  onChange={(e) => setFormData({ ...formData, space_id: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                  required
                >
                  <option value="">Selecteer ruimte</option>
                  {flexSpaces.map(space => (
                    <option key={space.id} value={space.id}>
                      {space.space_number} {space.flex_capacity && `(max ${space.flex_capacity} plekken)`}
                    </option>
                  ))}
                </select>
                {flexSpaces.length === 0 && (
                  <p className="text-xs text-amber-400 mt-1">
                    Geen flexruimtes beschikbaar. Configureer ruimtes als flexruimte in Producten.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Externe Klant *
                </label>
                <select
                  value={formData.external_customer_id}
                  onChange={(e) => setFormData({ ...formData, external_customer_id: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                  required
                >
                  <option value="">Selecteer klant</option>
                  {externalCustomers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Datum *
                </label>
                <input
                  type="date"
                  value={formData.booking_date}
                  onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                  required
                />
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tijd *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Starttijd
                    </label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Eindtijd
                    </label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  De eerste beschikbare plek wordt automatisch toegewezen. Tarief wordt automatisch berekend.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors font-medium"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors font-medium"
                >
                  Boeking Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedView === 'resource' ? (
        <div className="space-y-4">
          <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-300">Flexruimte:</label>
                <select
                  value={selectedResourceSpace}
                  onChange={(e) => setSelectedResourceSpace(e.target.value)}
                  className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                >
                  {flexSpaces.map(space => (
                    <option key={space.id} value={space.id}>
                      {space.space_number} {space.flex_capacity && `(${space.flex_capacity} plekken)`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={previousWeek}
                  className="p-2 text-gray-400 hover:text-gray-300 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-sm bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Vandaag
                </button>
                <button
                  onClick={nextWeek}
                  className="p-2 text-gray-400 hover:text-gray-300 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-gray-400 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-600"></div>
                <span>In afwachting (pending)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gold-500"></div>
                <span>Bevestigd</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span>Flex contract (vast)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-600"></div>
                <span>Gefactureerd</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-900/30 border border-emerald-600"></div>
                <span>Beschikbaar</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-4 bg-dark-800 rounded-lg p-2 border border-dark-700">
              <Info size={14} className="inline mr-1" />
              De tijdlijn toont de werkdag van 08:00 tot 18:00. Gekleurde blokken zijn boekingen, groene delen zijn beschikbaar. Klik op beschikbare tijd om te boeken.
            </div>
          </div>

          {selectedSpace && selectedSpace.flex_capacity ? (
            <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed" style={{ minWidth: '1300px' }}>
                  <colgroup>
                    <col style={{ width: '120px' }} />
                    {weekDays.map((_, idx) => (
                      <col key={idx} style={{ width: '170px' }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="bg-dark-800 border-b border-dark-700">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider sticky left-0 bg-dark-800 z-10">
                        Plek
                      </th>
                      {weekDays.map((date) => {
                        const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <th
                            key={date.toISOString()}
                            className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                              isToday ? 'text-gold-400' : isWeekend ? 'text-gray-500' : 'text-gray-400'
                            }`}
                          >
                            <div>{new Intl.DateTimeFormat('nl-NL', { weekday: 'short' }).format(date)}</div>
                            <div className={isToday ? 'text-gold-500 font-bold' : ''}>
                              {date.getDate()}/{date.getMonth() + 1}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {Array.from({ length: selectedSpace.flex_capacity }, (_, i) => i + 1).map((slotNumber) => (
                      <tr key={slotNumber} className="hover:bg-dark-800 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-100 sticky left-0 bg-dark-900 z-10">
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-gray-400" />
                            Plek {slotNumber}
                          </div>
                        </td>
                        {weekDays.map((date) => {
                          const dateStr = date.toISOString().split('T')[0];
                          const timeSegments = getTimeSegments(slotNumber, dateStr);
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          const isToday = dateStr === new Date().toISOString().split('T')[0];
                          const hasBookings = timeSegments.some(seg => seg.booking !== null);

                          return (
                            <td
                              key={dateStr}
                              className={`px-2 py-2 ${
                                isWeekend ? 'bg-dark-950' : ''
                              } ${isToday ? 'ring-2 ring-gold-500 ring-inset' : ''}`}
                            >
                              {isWeekend ? (
                                <div className="w-full h-[90px] flex items-center justify-center text-gray-600 text-sm">
                                  -
                                </div>
                              ) : hasBookings ? (
                                <div className="relative w-full h-[90px] bg-dark-800 rounded border border-dark-600 overflow-hidden">
                                  <div className="absolute inset-0 flex">
                                    {timeSegments.map((segment, idx) => {
                                      const totalHours = 10;
                                      const segmentHours = segment.endHour - segment.startHour;
                                      const widthPercent = (segmentHours / totalHours) * 100;

                                      if (segment.isAvailable) {
                                        return (
                                          <button
                                            key={idx}
                                            onClick={() => handleResourceSlotClick(dateStr, slotNumber)}
                                            className="h-full bg-emerald-900/30 border-r border-dark-600 hover:bg-emerald-800/40 transition-colors flex items-center justify-center group relative"
                                            style={{ width: `${widthPercent}%` }}
                                            title={`Beschikbaar: ${Math.floor(segment.startHour)}:${String((segment.startHour % 1) * 60).padStart(2, '0')} - ${Math.floor(segment.endHour)}:${String((segment.endHour % 1) * 60).padStart(2, '0')}`}
                                          >
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Plus size={16} className="text-emerald-400" />
                                            </div>
                                          </button>
                                        );
                                      }

                                      const booking = segment.booking!;
                                      const isPending = booking.type === 'booking' && booking.status === 'pending';
                                      const bgColor = booking.type === 'booking'
                                        ? booking.status === 'pending'
                                          ? 'bg-orange-600'
                                          : booking.isInvoiced || booking.status === 'completed'
                                          ? 'bg-green-600'
                                          : booking.status === 'cancelled'
                                          ? 'bg-red-600/70'
                                          : 'bg-gold-500'
                                        : 'bg-blue-500';

                                      return (
                                        <div
                                          key={idx}
                                          className={`relative h-full ${bgColor} border-r border-dark-900 flex flex-col items-center justify-center p-1 cursor-pointer hover:brightness-110 transition-all group`}
                                          style={{ width: `${widthPercent}%` }}
                                          title={`${booking.customerName}\n${booking.time || ''}\nStatus: ${booking.status || 'bevestigd'}`}
                                        >
                                          <div className="text-white text-[10px] font-bold text-center leading-tight line-clamp-2 px-0.5">
                                            {booking.customerName}
                                          </div>
                                          {booking.time && (
                                            <div className="text-white text-[9px] font-semibold mt-0.5 bg-black/20 px-1 rounded">
                                              {booking.time}
                                            </div>
                                          )}
                                          {isPending && booking.bookingId && (
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/80 transition-all flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleStatusChange(booking.bookingId!, 'confirmed');
                                                }}
                                                className="p-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                                                title="Accepteren"
                                              >
                                                <Check size={14} />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleStatusChange(booking.bookingId!, 'cancelled');
                                                }}
                                                className="p-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                                title="Weigeren"
                                              >
                                                <X size={14} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="absolute bottom-0 left-0 right-0 h-3 bg-dark-900/80 flex text-[8px] text-gray-500 font-medium">
                                    <div className="flex-1 border-r border-dark-700 flex items-center justify-center">08</div>
                                    <div className="flex-1 border-r border-dark-700 flex items-center justify-center">10</div>
                                    <div className="flex-1 border-r border-dark-700 flex items-center justify-center">12</div>
                                    <div className="flex-1 border-r border-dark-700 flex items-center justify-center">14</div>
                                    <div className="flex-1 border-r border-dark-700 flex items-center justify-center">16</div>
                                    <div className="flex-1 flex items-center justify-center">18</div>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleResourceSlotClick(dateStr, slotNumber)}
                                  className="w-full h-[90px] flex items-center justify-center text-lg text-gray-500 hover:bg-dark-700 hover:text-gray-300 rounded border border-dashed border-dark-700 transition-colors font-bold bg-emerald-900/10 hover:bg-emerald-900/20"
                                >
                                  +
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-8 text-center">
              <p className="text-gray-400">
                Deze flexruimte heeft geen capaciteit ingesteld. Configureer de capaciteit in Producten.
              </p>
            </div>
          )}
        </div>
      ) : selectedView === 'list' ? (
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-800 border-b border-dark-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Ruimte
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Plek
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Klant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Periode
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Bedrag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                      Geen boekingen gevonden
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-dark-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{formatDate(booking.booking_date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-100">
                          {booking.office_spaces?.space_number || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">
                          {booking.slot_number ? `Plek ${booking.slot_number}` : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-100">
                          {booking.external_customers?.company_name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">
                          {booking.start_time && booking.end_time
                            ? `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)} (${booking.total_hours.toFixed(1)}u)`
                            : booking.is_half_day
                            ? `Halve dag (${booking.half_day_period === 'morning' ? 'Ochtend' : 'Middag'})`
                            : 'Hele dag'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {booking.start_time && booking.end_time ? (
                          <div className="text-sm font-medium text-gray-100">
                            €{booking.total_amount.toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'pending'
                              ? 'bg-orange-900/50 text-orange-300 border border-orange-700'
                              : booking.status === 'confirmed'
                              ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                              : booking.status === 'completed' || booking.invoice_id
                              ? 'bg-green-900/50 text-green-300 border border-green-700'
                              : 'bg-red-900/50 text-red-300 border border-red-700'
                          }`}
                        >
                          {booking.status === 'pending' ? (
                            <>
                              <AlertCircle size={12} />
                              In afwachting
                            </>
                          ) : booking.status === 'confirmed' ? (
                            <>
                              <Check size={12} />
                              Bevestigd
                            </>
                          ) : booking.status === 'completed' || booking.invoice_id ? (
                            <>
                              <CheckCircle size={12} />
                              {booking.invoice_id ? 'Gefactureerd' : 'Voltooid'}
                            </>
                          ) : (
                            <>
                              <XCircle size={12} />
                              Geannuleerd
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {booking.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(booking.id, 'confirmed')}
                                className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded transition-colors"
                                title="Accepteren"
                              >
                                <Check size={18} />
                              </button>
                              <button
                                onClick={() => handleStatusChange(booking.id, 'cancelled')}
                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                                title="Weigeren"
                              >
                                <X size={18} />
                              </button>
                            </>
                          )}
                          {!booking.invoice_id && booking.status !== 'cancelled' && (
                            <button
                              onClick={() => setDeleteConfirmId(booking.id)}
                              className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                              title="Verwijder boeking"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 overflow-hidden">
          <div className="p-4 border-b border-dark-700">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={previousMonth}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-dark-800 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-lg font-semibold text-gray-100">
                {new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(currentDate)}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-sm bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Vandaag
                </button>
                <button
                  onClick={nextMonth}
                  className="p-2 text-gray-400 hover:text-gray-300 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="flex gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gold-500"></div>
                <span>Eenmalige boeking</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Flex contract (terugkerend)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-dark-700">
            {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => (
              <div key={day} className="bg-dark-800 px-2 py-3 text-center text-xs font-medium text-gray-400">
                {day}
              </div>
            ))}

            {calendarDays.map((day, index) => {
              const isToday = day.dateStr === new Date().toISOString().split('T')[0];
              return (
                <div
                  key={index}
                  onClick={() => handleCalendarDayClick(day.dateStr)}
                  className={`bg-dark-900 min-h-24 p-2 cursor-pointer hover:bg-dark-800 transition-colors ${
                    !day.isCurrentMonth ? 'opacity-40' : ''
                  } ${isToday ? 'ring-2 ring-gold-500 ring-inset' : ''}`}
                >
                  <div className={`text-sm mb-1 ${isToday ? 'text-gold-500 font-bold' : 'text-gray-400'}`}>
                    {day.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {day.schedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700 truncate"
                        title={schedule.external_customers?.company_name}
                      >
                        {schedule.external_customers?.company_name}
                      </div>
                    ))}
                    {day.bookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="text-xs px-1.5 py-0.5 rounded bg-gold-900/50 text-gold-300 border border-gold-700 truncate"
                        title={`${booking.external_customers?.company_name} - ${booking.is_half_day ? (booking.half_day_period === 'morning' ? 'Ochtend' : 'Middag') : 'Hele dag'}`}
                      >
                        {booking.external_customers?.company_name}
                        {booking.is_half_day && (
                          <span className="ml-1">({booking.half_day_period === 'morning' ? 'O' : 'M'})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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

      {showQuickBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-6 max-w-lg w-full mx-4 my-8 border border-dark-700">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-100">Nieuwe Boeking</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {formatDate(quickBookingDate)}
                  {quickBookingSlot && ` - Plek ${quickBookingSlot}`}
                </p>
              </div>
              <button
                onClick={() => setShowQuickBooking(false)}
                className="text-gray-400 hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleQuickBookingSubmit} className="space-y-4">
              {!quickBookingSlot && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Flexruimte *
                  </label>
                  <select
                    value={quickFormData.space_id}
                    onChange={(e) => setQuickFormData({ ...quickFormData, space_id: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                    required
                  >
                    <option value="">Selecteer ruimte</option>
                    {flexSpaces.map(space => (
                      <option key={space.id} value={space.id}>
                        {space.space_number} {space.flex_capacity && `(max ${space.flex_capacity} plekken)`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Eerste beschikbare plek wordt automatisch toegewezen
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Externe Klant *
                </label>
                <select
                  value={quickFormData.external_customer_id}
                  onChange={(e) => setQuickFormData({ ...quickFormData, external_customer_id: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                  required
                >
                  <option value="">Selecteer klant</option>
                  {externalCustomers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tijd *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Starttijd
                    </label>
                    <input
                      type="time"
                      value={quickFormData.start_time}
                      onChange={(e) => setQuickFormData({ ...quickFormData, start_time: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Eindtijd
                    </label>
                    <input
                      type="time"
                      value={quickFormData.end_time}
                      onChange={(e) => setQuickFormData({ ...quickFormData, end_time: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Tarief wordt automatisch berekend op basis van voordeligste optie
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowQuickBooking(false)}
                  className="flex-1 px-4 py-2 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors font-medium"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors font-medium"
                >
                  Boeking Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
