import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, X, CheckCircle, XCircle, Info, Repeat } from 'lucide-react';
import { RecurringBookingModal } from './RecurringBookingModal';

type NotificationType = 'success' | 'error' | 'info';

type Notification = {
  id: number;
  message: string;
  type: NotificationType;
};

type Booking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  tenant_id?: string;
  external_customer_id?: string;
  status?: 'confirmed' | 'cancelled' | 'completed';
  invoice_id?: string | null;
  recurring_pattern_id?: string | null;
  is_exception?: boolean;
  tenants?: { name: string; company_name: string };
  external_customers?: { company_name: string; contact_name: string };
  office_spaces?: { space_number: string };
};

type WeekDay = {
  date: Date;
  dateStr: string;
  bookings: Booking[];
};

type Space = {
  id: string;
  space_number: string;
  hourly_rate?: number;
};

type Tenant = {
  id: string;
  name: string;
  company_name: string;
  booking_pin_code?: string;
};

type ExternalCustomer = {
  id: string;
  company_name: string;
  contact_name: string;
  booking_pin_code?: string;
};

type SelectedCell = {
  date: string;
  time: string;
};

const timeSlots = Array.from({ length: 32 }, (_, i) => {
  const hour = Math.floor(i / 2) + 6;
  const minute = (i % 2) * 30;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const tenantColors = [
  { bg: 'bg-yellow-600', border: 'border-yellow-500', text: 'text-yellow-50' },
  { bg: 'bg-amber-600', border: 'border-amber-500', text: 'text-amber-50' },
  { bg: 'bg-orange-600', border: 'border-orange-500', text: 'text-orange-50' },
  { bg: 'bg-yellow-700', border: 'border-yellow-600', text: 'text-yellow-50' },
  { bg: 'bg-amber-700', border: 'border-amber-600', text: 'text-amber-50' },
  { bg: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-950' },
  { bg: 'bg-amber-500', border: 'border-amber-400', text: 'text-amber-950' },
  { bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-orange-950' },
  { bg: 'bg-yellow-800', border: 'border-yellow-700', text: 'text-yellow-50' },
  { bg: 'bg-amber-800', border: 'border-amber-700', text: 'text-amber-50' },
];

const getTenantColor = (tenantId: string | undefined) => {
  if (!tenantId) return tenantColors[0];
  const hash = tenantId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tenantColors[hash % tenantColors.length];
};

type BookingCalendarProps = {
  onBookingChange?: (action: 'created' | 'cancelled' | 'updated', bookingId: string) => void;
  loggedInTenantId?: string | null;
  bookingType?: 'tenant' | 'external';
};

export function BookingCalendar({ onBookingChange, loggedInTenantId = null, bookingType = 'tenant' }: BookingCalendarProps = {}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [baseMonth, setBaseMonth] = useState(new Date());
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [shouldScrollToTop, setShouldScrollToTop] = useState(false);
  const [meetingRooms, setMeetingRooms] = useState<Space[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<ExternalCustomer[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Space | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<SelectedCell | null>(null);
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formBookingType, setFormBookingType] = useState<'tenant' | 'external'>(bookingType);
  const [formData, setFormData] = useState({
    tenant_id: '',
    room_id: '',
    external_customer_id: ''
  });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteOption, setDeleteOption] = useState<'single' | 'all'>('single');
  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [isDraggingBooking, setIsDraggingBooking] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationId, setNotificationId] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [isProcessingTap, setIsProcessingTap] = useState(false);

  const showToast = (message: string, type: NotificationType = 'info') => {
    const id = notificationId;
    setNotificationId(id + 1);
    setNotifications(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };


  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    // Eerste load met loading state, daarna zonder voor vloeiendere transitions
    const isInitialLoad = weekDays.length === 0;
    loadData(isInitialLoad);
  }, [currentDate, baseMonth]);

  useEffect(() => {
    // Scroll to 8:00 AM when component mounts or data loads
    if (scrollContainerRef.current && !loading) {
      // 8:00 AM is index 4 in timeSlots (8 - 6 = 2 hours, 2 * 2 = 4)
      const targetIndex = 4;
      const cellHeight = 50;
      const scrollPosition = targetIndex * cellHeight;

      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPosition;
        }
      }, 100);
    }
  }, [loading]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (selectedCells.length > 0) {
          setShowForm(true);
        }
      }
      if (isDraggingBooking) {
        setIsDraggingBooking(false);
        setDraggedBooking(null);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, selectedCells, isDraggingBooking]);

  useEffect(() => {
    if (showForm && meetingRooms.length > 0 && !formData.room_id) {
      const spreekkamer1 = meetingRooms.find(r =>
        r.space_number.toLowerCase().includes('spreekkamer 1') ||
        r.space_number === '1'
      );

      if (spreekkamer1) {
        setFormData(prev => ({ ...prev, room_id: spreekkamer1.id }));
      } else if (meetingRooms.length === 1) {
        setFormData(prev => ({ ...prev, room_id: meetingRooms[0].id }));
      }
    }
  }, [showForm, meetingRooms, formData.room_id]);

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
  };

  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const hasBookingsOnDate = (dateStr: string) => {
    return allBookings.some(booking => booking.booking_date === dateStr);
  };

  const loadData = async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
    }

    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Also load all bookings for the mini calendars
    const firstDay = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1);
    const lastDay = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 3, 0);

    const [bookingsRes, spacesRes, tenantsRes, customersRes, allBookingsRes] = await Promise.all([
      supabase
        .from('meeting_room_bookings')
        .select(`
          id,
          booking_date,
          start_time,
          end_time,
          tenant_id,
          external_customer_id,
          status,
          invoice_id,
          recurring_pattern_id,
          is_exception,
          tenants(name, company_name),
          external_customers(company_name, contact_name),
          office_spaces(space_number)
        `)
        .gte('booking_date', formatLocalDate(weekStart))
        .lte('booking_date', formatLocalDate(weekEnd))
        .neq('status', 'cancelled')
        .order('start_time'),
      supabase
        .from('office_spaces')
        .select('id, space_number, hourly_rate')
        .eq('space_type', 'Meeting Room')
        .order('space_number'),
      supabase
        .from('tenants')
        .select('id, name, company_name, booking_pin_code')
        .order('name'),
      supabase
        .from('external_customers')
        .select('id, company_name, contact_name, booking_pin_code')
        .order('company_name'),
      supabase
        .from('meeting_room_bookings')
        .select('id, booking_date, start_time, end_time, tenant_id, external_customer_id, status')
        .gte('booking_date', formatLocalDate(firstDay))
        .lte('booking_date', formatLocalDate(lastDay))
        .neq('status', 'cancelled')
    ]);

    setAllBookings(allBookingsRes.data || []);
    setExternalCustomers(customersRes.data || []);

    const days: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatLocalDate(date);
      const dayBookings = (bookingsRes.data || []).filter(b => b.booking_date === dateStr);

      days.push({
        date,
        dateStr,
        bookings: dayBookings
      });
    }

    console.log('Loaded bookings:', bookingsRes.data);
    console.log('Week days with bookings:', days.map(d => ({ date: d.dateStr, bookings: d.bookings.length })));

    setWeekDays(days);
    const rooms = spacesRes.data || [];
    setMeetingRooms(rooms);

    // Automatically select the first room if there's only one
    if (rooms.length === 1 && !selectedRoom) {
      setSelectedRoom(rooms[0]);
    }

    setTenants(tenantsRes.data || []);

    if (shouldScrollToTop && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      setShouldScrollToTop(false);
    }

    setLoading(false);
  };

  const normalizeTime = (time: string) => {
    if (time.length === 5) return time;
    return time.substring(0, 5);
  };

  const hasBooking = (dateStr: string, time: string) => {
    const day = weekDays.find(d => d.dateStr === dateStr);
    if (!day) return false;

    return day.bookings.some(b => {
      const startTime = normalizeTime(b.start_time);
      const endTime = normalizeTime(b.end_time);
      return time >= startTime && time < endTime;
    });
  };

  const getBookingAtTime = (dateStr: string, time: string) => {
    const day = weekDays.find(d => d.dateStr === dateStr);
    if (!day) return null;

    return day.bookings.find(b => {
      const startTime = normalizeTime(b.start_time);
      return startTime === time;
    });
  };

  const handleCellMouseDown = (dateStr: string, time: string) => {
    if (hasBooking(dateStr, time)) return;

    const cellDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (cellDate < today) return;

    setIsDragging(true);
    setDragStart({ date: dateStr, time });
    setSelectedCells([{ date: dateStr, time }]);
  };

  const handleCellTap = (dateStr: string, time: string) => {
    if (isProcessingTap) return;
    if (hasBooking(dateStr, time)) return;

    const cellDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (cellDate < today) return;

    setIsProcessingTap(true);

    requestAnimationFrame(() => {
      const cellIndex = selectedCells.findIndex(c => c.date === dateStr && c.time === time);

      if (cellIndex !== -1) {
        const newCells = selectedCells.filter((_, i) => i !== cellIndex);
        setSelectedCells(newCells);
        setIsProcessingTap(false);
        return;
      }

      if (selectedCells.length === 0) {
        setSelectedCells([{ date: dateStr, time }]);
        setIsProcessingTap(false);
        return;
      }

      if (selectedCells[0].date !== dateStr) {
        setSelectedCells([{ date: dateStr, time }]);
        setIsProcessingTap(false);
        return;
      }

      const currentTimeIndex = timeSlots.indexOf(time);

      const timeIndices = selectedCells.map(c => timeSlots.indexOf(c.time));
      const minIndex = Math.min(...timeIndices);
      const maxIndex = Math.max(...timeIndices);

      if (currentTimeIndex === minIndex - 1 || currentTimeIndex === maxIndex + 1) {
        const newCells = [...selectedCells, { date: dateStr, time }];

        const newTimeIndices = newCells.map(c => timeSlots.indexOf(c.time));
        const newMinIndex = Math.min(...newTimeIndices);
        const newMaxIndex = Math.max(...newTimeIndices);
        const expectedLength = newMaxIndex - newMinIndex + 1;

        if (newCells.length !== expectedLength) {
          showToast('Selecteer alleen aaneengesloten tijdslots', 'error');
          setIsProcessingTap(false);
          return;
        }

        for (let i = newMinIndex; i <= newMaxIndex; i++) {
          const t = timeSlots[i];
          if (hasBooking(dateStr, t)) {
            showToast('Selecteer alleen aaneengesloten tijdslots', 'error');
            setIsProcessingTap(false);
            return;
          }
        }

        setSelectedCells(newCells);
      } else if (currentTimeIndex >= minIndex && currentTimeIndex <= maxIndex) {
        setSelectedCells([...selectedCells, { date: dateStr, time }]);
      } else {
        showToast('Selecteer alleen aaneengesloten tijdslots', 'error');
      }

      setIsProcessingTap(false);
    });
  };

  const handleCellMouseEnter = (dateStr: string, time: string) => {
    if (!isDragging || !dragStart || dragStart.date !== dateStr) return;

    const startIndex = timeSlots.indexOf(dragStart.time);
    const currentIndex = timeSlots.indexOf(time);
    const minIndex = Math.min(startIndex, currentIndex);
    const maxIndex = Math.max(startIndex, currentIndex);

    const cells: SelectedCell[] = [];
    for (let i = minIndex; i <= maxIndex; i++) {
      const t = timeSlots[i];
      if (!hasBooking(dateStr, t)) {
        cells.push({ date: dateStr, time: t });
      }
    }

    setSelectedCells(cells);
  };

  const isCellSelected = (dateStr: string, time: string) => {
    return selectedCells.some(c => c.date === dateStr && c.time === time);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCells.length === 0 || !formData.room_id) {
      showToast('Selecteer tijdslots en vergaderruimte', 'error');
      return;
    }

    // Validate based on booking type
    if (formBookingType === 'tenant') {
      const tenantIdToUse = loggedInTenantId || formData.tenant_id;
      if (!tenantIdToUse) {
        showToast('Selecteer een bedrijf', 'error');
        return;
      }
    } else {
      if (!formData.external_customer_id) {
        showToast('Selecteer een externe klant', 'error');
        return;
      }
    }

    const selectedRoomForBooking = meetingRooms.find(r => r.id === formData.room_id);
    if (!selectedRoomForBooking) return;

    const sortedCells = [...selectedCells].sort((a, b) => a.time.localeCompare(b.time));
    const startTime = sortedCells[0].time;
    const lastSlotTime = sortedCells[sortedCells.length - 1].time;
    const endIndex = timeSlots.indexOf(lastSlotTime) + 1;
    const endTime = timeSlots[endIndex] || '22:00';

    const calculateTotalHours = (start: string, end: string) => {
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return (endMinutes - startMinutes) / 60;
    };

    const totalHours = calculateTotalHours(startTime, endTime);
    const hourlyRate = selectedRoomForBooking.hourly_rate || 25;
    const totalAmount = totalHours * hourlyRate;

    const insertData: any = {
      space_id: selectedRoomForBooking.id,
      booking_type: bookingType,
      booking_date: selectedCells[0].date,
      start_time: startTime,
      end_time: endTime,
      hourly_rate: hourlyRate,
      total_hours: totalHours,
      total_amount: totalAmount,
      status: 'confirmed'
    };

    if (formBookingType === 'tenant') {
      const tenantIdToUse = loggedInTenantId || formData.tenant_id;
      insertData.tenant_id = tenantIdToUse;
    } else {
      insertData.external_customer_id = formData.external_customer_id;
    }

    const { data: newBooking, error } = await supabase
      .from('meeting_room_bookings')
      .insert(insertData)
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        tenant_id,
        external_customer_id,
        status,
        invoice_id,
        tenants(name, company_name),
        external_customers(company_name, contact_name),
        office_spaces(space_number)
      `)
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      showToast('Fout bij het aanmaken van de boeking: ' + error.message, 'error');
      return;
    }

    if (newBooking) {
      setWeekDays(prev => prev.map(day => {
        if (day.dateStr === newBooking.booking_date) {
          return {
            ...day,
            bookings: [...day.bookings, newBooking].sort((a, b) =>
              a.start_time.localeCompare(b.start_time)
            )
          };
        }
        return day;
      }));

      setAllBookings(prev => [...prev, {
        id: newBooking.id,
        booking_date: newBooking.booking_date,
        start_time: newBooking.start_time,
        end_time: newBooking.end_time,
        tenant_id: newBooking.tenant_id,
        external_customer_id: newBooking.external_customer_id,
        status: newBooking.status
      }]);
    }

    showToast('Boeking succesvol aangemaakt', 'success');
    setShowForm(false);
    setSelectedCells([]);
    setFormData({
      tenant_id: '',
      room_id: '',
      external_customer_id: ''
    });
    if (onBookingChange) {
      onBookingChange('created', newBooking.id);
    }
  };

  const previousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setShouldScrollToTop(true);
    setCurrentDate(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setShouldScrollToTop(true);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setShouldScrollToTop(true);
    const today = new Date();
    setCurrentDate(today);
    setBaseMonth(today);
  };


  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDeleteConfirm(true);
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;

    if (selectedBooking.recurring_pattern_id && deleteOption === 'all') {
      const today = new Date().toISOString().split('T')[0];

      const { error: patternError } = await supabase
        .from('recurring_booking_patterns')
        .update({ is_active: false, end_date: today })
        .eq('id', selectedBooking.recurring_pattern_id);

      if (patternError) {
        console.error('Error deactivating recurring pattern:', patternError);
        showToast('Fout bij het annuleren van terugkerende boekingen', 'error');
        return;
      }

      const { error: bookingsError } = await supabase
        .from('meeting_room_bookings')
        .update({ status: 'cancelled' })
        .eq('recurring_pattern_id', selectedBooking.recurring_pattern_id)
        .gte('booking_date', today);

      if (bookingsError) {
        console.error('Error cancelling future bookings:', bookingsError);
        showToast('Fout bij het annuleren van toekomstige boekingen', 'error');
        return;
      }

      showToast('Alle toekomstige boekingen succesvol geannuleerd', 'success');
    } else {
      const { error } = await supabase
        .from('meeting_room_bookings')
        .update({ status: 'cancelled', is_exception: selectedBooking.recurring_pattern_id ? true : false })
        .eq('id', selectedBooking.id);

      if (error) {
        console.error('Error cancelling booking:', error);
        showToast('Fout bij het annuleren van de boeking', 'error');
        return;
      }

      showToast('Boeking succesvol geannuleerd', 'success');
    }

    await loadData();

    setShowDeleteConfirm(false);
    setSelectedBooking(null);
    setDeleteOption('single');

    if (onBookingChange) {
      onBookingChange('cancelled', selectedBooking.id);
    }
  };

  const handleBookingDragStart = (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedBooking(booking);
    setIsDraggingBooking(true);
  };

  const handleBookingDrop = async (dateStr: string, time: string) => {
    if (!draggedBooking || !isDraggingBooking) return;

    const cellDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (cellDate < today) {
      showToast('Kan geen boeking verplaatsen naar het verleden', 'error');
      setDraggedBooking(null);
      setIsDraggingBooking(false);
      return;
    }

    if (hasBooking(dateStr, time)) {
      showToast('Er is al een boeking op dit tijdstip', 'error');
      setDraggedBooking(null);
      setIsDraggingBooking(false);
      return;
    }

    const startTime = normalizeTime(draggedBooking.start_time);
    const endTime = normalizeTime(draggedBooking.end_time);

    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = timeSlots.indexOf(endTime);
    const duration = endIndex - startIndex;

    const newStartIndex = timeSlots.indexOf(time);
    const newEndIndex = newStartIndex + duration;

    if (newEndIndex >= timeSlots.length) {
      showToast('Boeking past niet meer in de dag', 'error');
      setDraggedBooking(null);
      setIsDraggingBooking(false);
      return;
    }

    const newStartTime = timeSlots[newStartIndex];
    const newEndTime = timeSlots[newEndIndex];

    const { error } = await supabase
      .from('meeting_room_bookings')
      .update({
        booking_date: dateStr,
        start_time: newStartTime,
        end_time: newEndTime
      })
      .eq('id', draggedBooking.id);

    if (error) {
      console.error('Error moving booking:', error);
      showToast('Fout bij het verplaatsen van de boeking', 'error');
      setDraggedBooking(null);
      setIsDraggingBooking(false);
      return;
    }

    // Update booking in state
    const updatedBooking = {
      ...draggedBooking,
      booking_date: dateStr,
      start_time: newStartTime,
      end_time: newEndTime
    };

    setWeekDays(prev => prev.map(day => {
      // Remove from old date
      const bookingsWithoutOld = day.bookings.filter(b => b.id !== draggedBooking.id);

      // Add to new date if it matches
      if (day.dateStr === dateStr) {
        return {
          ...day,
          bookings: [...bookingsWithoutOld, updatedBooking].sort((a, b) =>
            a.start_time.localeCompare(b.start_time)
          )
        };
      }

      return {
        ...day,
        bookings: bookingsWithoutOld
      };
    }));

    setDraggedBooking(null);
    setIsDraggingBooking(false);
    if (onBookingChange) {
      onBookingChange('updated', draggedBooking.id);
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const getBookingHeight = (booking: Booking) => {
    const startTime = normalizeTime(booking.start_time);
    const endTime = normalizeTime(booking.end_time);

    const startIndex = timeSlots.indexOf(startTime);
    const endIndex = timeSlots.indexOf(endTime);

    if (startIndex === -1 || endIndex === -1) return 1;

    const slots = endIndex - startIndex;
    return slots;
  };

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const weekRange = weekDays.length > 0
    ? `Week ${getWeekNumber(weekDays[0].date)} - ${weekDays[0].date.getDate()} ${weekDays[0].date.toLocaleDateString('nl-NL', { month: 'short' })} - ${weekDays[6].date.getDate()} ${weekDays[6].date.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}`
    : '';

  if (loading) {
    return <div className="text-center py-8 text-gray-300">Kalender laden...</div>;
  }

  const CELL_HEIGHT = 50;

  // Generate month calendar data
  const generateMonthDays = () => {
    const firstDay = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1);
    const lastDay = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = [];

    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Previous month days
    const prevMonthDays = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(baseMonth.getFullYear(), baseMonth.getMonth() - 1, prevMonthDays - i);
      const dateStr = formatLocalDate(date);
      date.setHours(12, 0, 0, 0);
      days.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        date: dateStr,
        isSelected: false
      });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), i);
      const dateStr = formatLocalDate(date);
      date.setHours(12, 0, 0, 0);
      days.push({
        day: i,
        isCurrentMonth: true,
        date: dateStr,
        isSelected: date >= weekStart && date <= weekEnd
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, i);
      const dateStr = formatLocalDate(date);
      date.setHours(12, 0, 0, 0);
      days.push({
        day: i,
        isCurrentMonth: false,
        date: dateStr,
        isSelected: false
      });
    }

    return days;
  };

  const monthDays = generateMonthDays();

  // Generate next month calendar data
  const generateNextMonthDays = () => {
    const firstDay = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1);
    const lastDay = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 2, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = [];

    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Previous month days
    const prevMonthDays = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), prevMonthDays - i);
      const dateStr = formatLocalDate(date);
      date.setHours(12, 0, 0, 0);
      days.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        date: dateStr,
        isSelected: false
      });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, i);
      const dateStr = formatLocalDate(date);
      date.setHours(12, 0, 0, 0);
      days.push({
        day: i,
        isCurrentMonth: true,
        date: dateStr,
        isSelected: date >= weekStart && date <= weekEnd
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 2, i);
      const dateStr = formatLocalDate(date);
      date.setHours(12, 0, 0, 0);
      days.push({
        day: i,
        isCurrentMonth: false,
        date: dateStr,
        isSelected: false
      });
    }

    return days;
  };

  const nextMonthDays = generateNextMonthDays();

  // Generate third month calendar data
  const generateThirdMonthDays = () => {
    const firstDay = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 2, 1);
    const lastDay = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 3, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = [];

    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Previous month days
    const prevMonthDays = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 2, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, prevMonthDays - i);
      const dateStr = formatLocalDate(date);
      date.setHours(12, 0, 0, 0);
      days.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        date: dateStr,
        isSelected: false
      });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 2, i);
      const dateStr = formatLocalDate(date);
      date.setHours(12, 0, 0, 0);
      days.push({
        day: i,
        isCurrentMonth: true,
        date: dateStr,
        isSelected: date >= weekStart && date <= weekEnd
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 3, i);
      const dateStr = formatLocalDate(date);
      date.setHours(12, 0, 0, 0);
      days.push({
        day: i,
        isCurrentMonth: false,
        date: dateStr,
        isSelected: false
      });
    }

    return days;
  };

  const thirdMonthDays = generateThirdMonthDays();

  const renderMonthCalendar = (days: typeof monthDays, monthDate: Date, isCurrentMonth: boolean, monthOffset: number) => {
    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200">
            {monthDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
          </h3>
          {isCurrentMonth && (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setShouldScrollToTop(false);
                  const newBase = new Date(baseMonth.getFullYear(), baseMonth.getMonth() - 1);
                  setBaseMonth(newBase);
                  setCurrentDate(newBase);
                }}
                className="p-1 hover:bg-dark-700 rounded"
              >
                <ChevronLeft size={16} className="text-gray-300" />
              </button>
              <button
                onClick={() => {
                  setShouldScrollToTop(false);
                  const newBase = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1);
                  setBaseMonth(newBase);
                  setCurrentDate(newBase);
                }}
                className="p-1 hover:bg-dark-700 rounded"
              >
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            </div>
          )}
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="text-[10px] text-gray-400 text-center font-semibold">#</div>
          {['MA', 'DI', 'WO', 'DO', 'VR', 'ZA', 'ZO'].map(day => (
            <div key={day} className="text-[10px] text-gray-400 text-center font-semibold">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 6 }).map((_, weekIdx) => {
            const weekDays = days.slice(weekIdx * 7, (weekIdx + 1) * 7);
            const hasCurrentMonthDay = weekDays.some(day => day.isCurrentMonth);

            // Don't render week row if it has no days from current month
            if (!hasCurrentMonthDay) return null;

            const weekStart = weekDays.find(day => day.date);
            const weekNum = weekStart && weekStart.date ? getWeekNumber(new Date(weekStart.date)) : '';

            return (
              <>
                <div key={`week-${weekIdx}`} className="text-[10px] text-gray-500 text-center py-1">
                  {weekNum}
                </div>
                {weekDays.map((dayInfo, idx) => {
                  const isSelected = dayInfo.isSelected;
                  const isTodayDate = dayInfo.date && isToday(new Date(dayInfo.date));
                  const hasBookings = dayInfo.date && hasBookingsOnDate(dayInfo.date);

                  return (
                    <button
                      key={`${weekIdx}-${idx}`}
                      onClick={() => {
                        if (dayInfo.date) {
                          setShouldScrollToTop(false);
                          setCurrentDate(new Date(dayInfo.date));
                        }
                      }}
                      disabled={!dayInfo.date}
                      className={`relative text-xs py-1 rounded ${
                        hasBookings && !isSelected
                          ? 'ring-2 ring-yellow-400 ring-inset'
                          : ''
                      } ${
                        isSelected
                          ? 'bg-gold-600 text-dark-900 font-semibold'
                          : isTodayDate
                          ? 'bg-yellow-900/50 text-yellow-300 font-semibold'
                          : !dayInfo.isCurrentMonth
                          ? 'text-gray-600 hover:bg-dark-700 cursor-pointer'
                          : 'text-gray-300 hover:bg-dark-700 cursor-pointer'
                      }`}
                    >
                      {dayInfo.day}
                    </button>
                  );
                })}
              </>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="relative">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border backdrop-blur-sm animate-slide-in ${
              notification.type === 'success'
                ? 'bg-green-900/90 border-green-700 text-green-100'
                : notification.type === 'error'
                ? 'bg-red-900/90 border-red-700 text-red-100'
                : 'bg-yellow-900/90 border-yellow-700 text-yellow-100'
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

      <div className="flex gap-4 w-full" style={{ height: '720px' }}>
        {/* Left Sidebar - Month Calendars */}
      <div className="w-72 bg-dark-900 rounded-lg p-4 flex-shrink-0 flex flex-col">
        {/* Current Month */}
        <div className="mb-6">
          {renderMonthCalendar(monthDays, baseMonth, true, 0)}
        </div>

        {/* Next Month */}
        <div className="mb-6">
          {renderMonthCalendar(nextMonthDays, new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1), false, 1)}
        </div>

        {/* Third Month */}
        <div className="mb-4">
          {renderMonthCalendar(thirdMonthDays, new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 2), false, 2)}
        </div>

        <button
          onClick={goToToday}
          className="w-full px-3 py-2 text-sm bg-dark-800 text-gray-200 rounded hover:bg-dark-700 transition-colors"
        >
          Vandaag
        </button>
      </div>

      {/* Right Side - Week View */}
      <div className="flex-1 bg-dark-900 rounded-lg overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="bg-dark-800 px-4 py-3 flex items-center justify-between border-b border-dark-700">
          <div className="flex items-center gap-3">
            <button
              onClick={previousWeek}
              className="p-1 hover:bg-dark-700 rounded"
            >
              <ChevronLeft size={18} className="text-gray-300" />
            </button>
            <h2 className="text-base font-semibold text-gray-100">{weekRange}</h2>
            <button
              onClick={nextWeek}
              className="p-1 hover:bg-dark-700 rounded"
            >
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          </div>
          <button
            onClick={() => setShowRecurringModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-white rounded hover:bg-gold-600 transition-colors text-sm font-medium"
          >
            <Repeat size={16} />
            Terugkerende Boeking
          </button>
        </div>

        {/* Touch Device Instruction */}
        {isTouchDevice && (
          <div className="bg-dark-800/50 border-b border-dark-700 px-4 py-2">
            <p className="text-xs text-gray-300 text-center">
              Tik op tijdslots om te selecteren. Tik nogmaals om de selectie ongedaan te maken.
            </p>
          </div>
        )}

        {/* Calendar Grid */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-dark-950">
          <div className="min-w-[900px]" style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)' }}>
            {/* Header row */}
            <div className="sticky top-0 z-20 bg-dark-800 border-b border-dark-700" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div className="p-2"></div>
              {weekDays.map((day) => {
                const isTodayDate = isToday(day.date);
                return (
                  <div
                    key={day.dateStr}
                    className={`p-2 text-center border-l border-dark-600 ${
                      isTodayDate ? 'bg-yellow-900/30' : ''
                    }`}
                  >
                    <div className="text-xs text-gray-400 uppercase">
                      {day.date.toLocaleDateString('nl-NL', { weekday: 'short' })}
                    </div>
                    <div className={`text-2xl font-light ${
                      isTodayDate ? 'text-yellow-400' : 'text-gray-200'
                    }`}>
                      {day.date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time column */}
            <div className="bg-dark-900">
              {timeSlots.map((time) => {
                const [hour] = time.split(':').map(Number);
                // Only show on the hour
                const showTime = time.endsWith(':00');
                return (
                  <div
                    key={time}
                    className="text-[10px] text-gray-500 bg-dark-900 pr-2 text-right border-b border-dark-700"
                    style={{ height: `${CELL_HEIGHT}px`, lineHeight: `${CELL_HEIGHT}px` }}
                  >
                    {showTime ? time : ''}
                  </div>
                );
              })}
            </div>

          {weekDays.map((day) => {
            const isTodayDate = isToday(day.date);
            return (
              <div key={day.dateStr} className={`relative border-l border-dark-600 ${isTodayDate ? 'bg-yellow-900/10' : 'bg-dark-950'}`}>
                {timeSlots.map((time) => {
                  const booking = getBookingAtTime(day.dateStr, time);
                  const hasBookingHere = hasBooking(day.dateStr, time);
                  const isSelected = isCellSelected(day.dateStr, time);

                  const cellDate = new Date(day.dateStr + 'T00:00:00');
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isPast = cellDate < today;

                  const [hour] = time.split(':').map(Number);
                  const isWorkHours = hour >= 8 && hour < 17;

                  return (
                    <div
                      key={time}
                      className={`relative border-b border-gray-700 ${
                        !hasBookingHere && !isPast ? 'cursor-pointer hover:bg-dark-800/50' : ''
                      } ${isSelected ? (isTouchDevice ? 'bg-yellow-500/60 border-2 border-yellow-300' : 'bg-yellow-200/40 border-2 border-yellow-400') : ''} ${isPast ? 'bg-dark-950/50' : !isWorkHours ? 'bg-gray-900' : 'bg-dark-800'} ${isDraggingBooking && !hasBookingHere && !isPast ? 'bg-green-900/20' : ''} ${isTouchDevice && !hasBookingHere && !isPast ? 'active:bg-yellow-500/30 transition-colors' : ''}`}
                      style={{ height: `${CELL_HEIGHT}px` }}
                      onMouseDown={(e) => {
                        if (!isDraggingBooking && !isTouchDevice) {
                          handleCellMouseDown(day.dateStr, time);
                        }
                      }}
                      onMouseEnter={() => {
                        if (!isDraggingBooking && !isTouchDevice) {
                          handleCellMouseEnter(day.dateStr, time);
                        }
                      }}
                      onMouseUp={() => {
                        if (isDraggingBooking && !hasBookingHere && !isPast) {
                          handleBookingDrop(day.dateStr, time);
                        }
                      }}
                      onClick={() => {
                        if (isTouchDevice && !isDraggingBooking && !hasBookingHere && !isPast) {
                          handleCellTap(day.dateStr, time);
                        }
                      }}
                    >
                      {booking && (() => {
                        const colors = getTenantColor(booking.tenant_id);
                        const isBeingDragged = draggedBooking?.id === booking.id;
                        const isCompleted = booking.status === 'completed';
                        const bookingHeight = getBookingHeight(booking) * CELL_HEIGHT - 2;
                        const isSingleSlot = bookingHeight <= 50;

                        return (
                          <div
                            className={`absolute left-1 right-1 ${colors.bg} border-l-4 ${colors.border} rounded shadow-sm px-1.5 py-1 z-10 cursor-move hover:shadow-md transition-shadow select-none flex flex-col justify-center ${isBeingDragged ? 'opacity-50' : isCompleted ? 'opacity-70' : ''}`}
                            style={{
                              height: `${bookingHeight}px`,
                              top: '1px',
                              overflow: 'hidden'
                            }}
                            title={`${booking.office_spaces?.space_number} - ${booking.external_customer_id ? `Extern: ${booking.external_customers?.company_name}` : booking.tenants?.company_name || ''} (${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)})${isCompleted ? ' - Voltooid' : ''}${booking.invoice_id ? ' - Gefactureerd' : ''}\nKlik om te beheren, sleep om te verplaatsen`}
                            onMouseDown={(e) => {
                              if (e.button === 0) {
                                handleBookingDragStart(booking, e);
                              }
                            }}
                            onClick={(e) => {
                              if (!isDraggingBooking) {
                                e.stopPropagation();
                                handleBookingClick(booking);
                              }
                            }}
                          >
                            <div className="w-full">
                              {booking.external_customer_id ? (
                                <>
                                  <div className={`font-medium ${colors.text} text-[10px] uppercase leading-tight opacity-75`}>
                                    EXTERN
                                  </div>
                                  <div className={`font-semibold ${colors.text} text-xs leading-tight truncate`}>
                                    {booking.external_customers?.company_name}
                                  </div>
                                </>
                              ) : (
                                <div className={`font-semibold ${colors.text} text-xs leading-tight truncate`}>
                                  {booking.tenants?.company_name || ''}
                                </div>
                              )}
                              <div className={`${colors.text} text-[11px] opacity-90 leading-tight mt-0.5`}>
                                {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
            </div>
          );
          })}
          </div>
        </div>
      </div>

      {/* Floating Action Button for Touch Devices */}
      {isTouchDevice && selectedCells.length > 0 && !showForm && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
          <div className="bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
            {selectedCells.length} tijdslot{selectedCells.length !== 1 ? 's' : ''} geselecteerd
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCells([])}
              className="px-4 py-3 bg-dark-800 text-white rounded-full shadow-lg hover:bg-dark-700 transition-all"
            >
              Annuleren
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-yellow-600 text-white rounded-full shadow-lg hover:bg-yellow-700 transition-all font-medium"
            >
              Doorgaan →
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-100">Nieuwe Boeking</h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setSelectedCells([]);
                }}
                className="text-gray-400 hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmitBooking} className="space-y-4">
              {selectedCells.length > 0 && (() => {
                const sortedCells = [...selectedCells].sort((a, b) => a.time.localeCompare(b.time));
                const startTime = sortedCells[0].time;
                const lastSlotTime = sortedCells[sortedCells.length - 1].time;
                const endIndex = timeSlots.indexOf(lastSlotTime) + 1;
                const endTime = timeSlots[endIndex] || '22:00';
                const bookingDate = new Date(sortedCells[0].date + 'T00:00:00');

                const calculateTotalHours = (start: string, end: string) => {
                  const [startHour, startMin] = start.split(':').map(Number);
                  const [endHour, endMin] = end.split(':').map(Number);
                  const startMinutes = startHour * 60 + startMin;
                  const endMinutes = endHour * 60 + endMin;
                  return (endMinutes - startMinutes) / 60;
                };

                const totalHours = calculateTotalHours(startTime, endTime);
                const selectedRoomForCalc = meetingRooms.find(r => r.id === formData.room_id);
                const hourlyRate = selectedRoomForCalc?.hourly_rate || 25;
                const totalAmount = totalHours * hourlyRate;

                return (
                  <div className="bg-dark-700 rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold text-gold-500 mb-2">Geselecteerde tijd</h4>
                    <p className="text-gray-300">
                      <strong>Datum:</strong> {bookingDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-gray-300">
                      <strong>Tijd:</strong> {startTime} - {endTime}
                    </p>
                    <p className="text-gray-300">
                      <strong>Duur:</strong> {totalHours.toFixed(1)} uur
                    </p>
                  </div>
                );
              })()}

              <div className="mb-6">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormBookingType('tenant')}
                    className={`px-4 py-2 font-medium rounded-lg transition-all ${
                      formBookingType === 'tenant'
                        ? 'bg-gold-500 text-white shadow-lg'
                        : 'bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-gray-300'
                    }`}
                  >
                    Huurder
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormBookingType('external')}
                    className={`px-4 py-2 font-medium rounded-lg transition-all ${
                      formBookingType === 'external'
                        ? 'bg-gold-500 text-white shadow-lg'
                        : 'bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-gray-300'
                    }`}
                  >
                    Externe partij
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Vergaderruimte *
                </label>
                <select
                  value={formData.room_id}
                  onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecteer een vergaderruimte</option>
                  {meetingRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.space_number}
                    </option>
                  ))}
                </select>
              </div>

              {formBookingType === 'tenant' && loggedInTenantId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Bedrijf
                  </label>
                  <div className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-700 text-gray-100">
                    {tenants.find(t => t.id === loggedInTenantId)?.company_name ||
                     tenants.find(t => t.id === loggedInTenantId)?.name || 'Onbekend'}
                  </div>
                </div>
              ) : formBookingType === 'tenant' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Bedrijf *
                  </label>
                  <select
                    value={formData.tenant_id}
                    onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                    className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecteer een bedrijf</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.company_name || tenant.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Externe klant *
                  </label>
                  <select
                    value={formData.external_customer_id}
                    onChange={(e) => setFormData({ ...formData, external_customer_id: e.target.value })}
                    className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecteer een externe klant</option>
                    {externalCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setSelectedCells([]);
                    setFormData({
                      tenant_id: '',
                      room_id: '',
                      external_customer_id: ''
                    });
                  }}
                  className="px-6 py-2 border border-dark-600 rounded-lg text-gray-300 hover:bg-dark-700 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={
                    selectedCells.length === 0 ||
                    !formData.room_id ||
                    (formBookingType === 'tenant' && !loggedInTenantId && !formData.tenant_id) ||
                    (formBookingType === 'external' && !formData.external_customer_id)
                  }
                  className="px-6 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Boeking Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 max-w-md w-full border border-dark-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-100">Boeking Beheren</h3>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedBooking(null);
                }}
                className="text-gray-400 hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6 space-y-2 text-gray-300">
              <p><strong>Ruimte:</strong> {selectedBooking.office_spaces?.space_number}</p>
              {selectedBooking.external_customer_id ? (
                <>
                  <p className="text-blue-400"><strong>Type:</strong> Externe boeking</p>
                  <p><strong>Bedrijf:</strong> {selectedBooking.external_customers?.company_name}</p>
                  <p><strong>Contactpersoon:</strong> {selectedBooking.external_customers?.contact_name}</p>
                </>
              ) : (
                <p><strong>Bedrijf:</strong> {selectedBooking.tenants?.company_name || selectedBooking.tenants?.name}</p>
              )}
              <p><strong>Datum:</strong> {new Date(selectedBooking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL')}</p>
              <p><strong>Tijd:</strong> {selectedBooking.start_time.substring(0, 5)} - {selectedBooking.end_time.substring(0, 5)}</p>
              {selectedBooking.recurring_pattern_id && (
                <p className="text-blue-400 flex items-center gap-1"><Repeat size={14} /> <strong>Terugkerende boeking</strong></p>
              )}
              {selectedBooking.invoice_id && (
                <p className="text-amber-500"><strong>Let op:</strong> Deze boeking is al gefactureerd</p>
              )}
            </div>

            <div className="space-y-3">
              {selectedBooking.recurring_pattern_id && selectedBooking.status !== 'cancelled' && (
                <div className="bg-dark-800 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-gray-300 font-medium mb-2">Annuleer optie:</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteOption"
                      value="single"
                      checked={deleteOption === 'single'}
                      onChange={(e) => setDeleteOption(e.target.value as 'single' | 'all')}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-200">Alleen deze boeking</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteOption"
                      value="all"
                      checked={deleteOption === 'all'}
                      onChange={(e) => setDeleteOption(e.target.value as 'single' | 'all')}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-200">Alle toekomstige boekingen</span>
                  </label>
                </div>
              )}
              {selectedBooking.status !== 'cancelled' && (
                <>
                  {loggedInTenantId ? (
                    selectedBooking.tenant_id === loggedInTenantId ? (
                      <button
                        onClick={handleCancelBooking}
                        className="w-full px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Boeking Annuleren
                      </button>
                    ) : (
                      <div className="w-full px-6 py-3 bg-amber-900/30 border border-amber-700 rounded-lg text-amber-300 text-center text-sm">
                        Je kunt alleen je eigen boekingen annuleren
                      </div>
                    )
                  ) : (
                    <button
                      onClick={handleCancelBooking}
                      className="w-full px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Boeking Annuleren
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedBooking(null);
                }}
                className="w-full px-6 py-2 border border-dark-600 rounded-lg text-gray-300 hover:bg-dark-700 transition-colors"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      <RecurringBookingModal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        onSuccess={() => {
          loadData();
          showToast('Terugkerende boeking succesvol aangemaakt', 'success');
        }}
        spaces={meetingRooms}
        tenants={tenants}
        preSelectedTenantId={loggedInTenantId}
      />
      </div>
    </div>
  );
}
