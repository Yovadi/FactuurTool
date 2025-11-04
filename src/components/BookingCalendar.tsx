import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, X, CheckCircle, XCircle, Info } from 'lucide-react';

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
  status?: 'confirmed' | 'cancelled' | 'completed';
  invoice_id?: string | null;
  tenants?: { name: string; company_name: string };
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

type SelectedCell = {
  date: string;
  time: string;
};

const timeSlots = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const tenantColors = [
  { bg: 'bg-blue-600', border: 'border-blue-500', text: 'text-white' },
  { bg: 'bg-green-600', border: 'border-green-500', text: 'text-white' },
  { bg: 'bg-purple-600', border: 'border-purple-500', text: 'text-white' },
  { bg: 'bg-red-600', border: 'border-red-500', text: 'text-white' },
  { bg: 'bg-orange-600', border: 'border-orange-500', text: 'text-white' },
  { bg: 'bg-pink-600', border: 'border-pink-500', text: 'text-white' },
  { bg: 'bg-teal-600', border: 'border-teal-500', text: 'text-white' },
  { bg: 'bg-cyan-600', border: 'border-cyan-500', text: 'text-white' },
  { bg: 'bg-indigo-600', border: 'border-indigo-500', text: 'text-white' },
  { bg: 'bg-amber-600', border: 'border-amber-500', text: 'text-white' },
];

const getTenantColor = (tenantId: string | undefined) => {
  if (!tenantId) return tenantColors[0];
  const hash = tenantId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tenantColors[hash % tenantColors.length];
};

type BookingCalendarProps = {
  onBookingChange?: () => void;
};

export function BookingCalendar({ onBookingChange }: BookingCalendarProps = {}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [baseMonth, setBaseMonth] = useState(new Date());
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [shouldScrollToTop, setShouldScrollToTop] = useState(false);
  const [meetingRooms, setMeetingRooms] = useState<Space[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Space | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<SelectedCell | null>(null);
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tenant_id: '',
    room_id: ''
  });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [draggedBooking, setDraggedBooking] = useState<Booking | null>(null);
  const [isDraggingBooking, setIsDraggingBooking] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [isProduction, setIsProduction] = useState(false);
  const [verifiedTenantId, setVerifiedTenantId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationId, setNotificationId] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: NotificationType = 'info') => {
    const id = notificationId;
    setNotificationId(id + 1);
    setNotifications(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useEffect(() => {
    // Detect if running in production (not dev, not Electron)
    const isDev = import.meta.env.DEV;
    const electron = typeof window !== 'undefined' && (window as any).electron;
    const isProd = !isDev && !electron;
    setIsProduction(isProd);

    // Show PIN modal on production if not verified
    if (isProd && !isPinVerified) {
      setShowPinModal(true);
    }
  }, [isPinVerified]);

  useEffect(() => {
    // Eerste load met loading state, daarna zonder voor vloeiendere transitions
    const isInitialLoad = weekDays.length === 0;
    loadData(isInitialLoad);
  }, [currentDate]);

  useEffect(() => {
    // Scroll to 8:00 AM when component mounts or data loads
    if (scrollContainerRef.current && !loading) {
      // 8:00 AM is index 16 in timeSlots (8 * 2 = 16)
      const targetIndex = 16;
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

  const loadData = async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
    }

    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const [bookingsRes, spacesRes, tenantsRes] = await Promise.all([
      supabase
        .from('meeting_room_bookings')
        .select(`
          id,
          booking_date,
          start_time,
          end_time,
          tenant_id,
          status,
          invoice_id,
          tenants(name, company_name),
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
        .order('name')
    ]);

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

    // On production, use verified tenant ID, otherwise use selected tenant from form
    const tenantIdToUse = isProduction && verifiedTenantId ? verifiedTenantId : formData.tenant_id;
    if (!tenantIdToUse) {
      showToast('Selecteer een bedrijf', 'error');
      return;
    }

    const selectedRoomForBooking = meetingRooms.find(r => r.id === formData.room_id);
    if (!selectedRoomForBooking) return;

    const sortedCells = [...selectedCells].sort((a, b) => a.time.localeCompare(b.time));
    const startTime = sortedCells[0].time;
    const lastSlotTime = sortedCells[sortedCells.length - 1].time;
    const endIndex = timeSlots.indexOf(lastSlotTime) + 1;
    const endTime = timeSlots[endIndex] || '23:59';

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

    const { error } = await supabase
      .from('meeting_room_bookings')
      .insert({
        space_id: selectedRoomForBooking.id,
        tenant_id: tenantIdToUse,
        booking_date: selectedCells[0].date,
        start_time: startTime,
        end_time: endTime,
        hourly_rate: hourlyRate,
        total_hours: totalHours,
        total_amount: totalAmount,
        status: 'confirmed'
      });

    if (error) {
      console.error('Error creating booking:', error);
      showToast('Fout bij het aanmaken van de boeking: ' + error.message, 'error');
      return;
    }

    // Fetch the newly created booking with its relations
    const { data: newBooking } = await supabase
      .from('meeting_room_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        tenant_id,
        status,
        invoice_id,
        tenants(name, company_name),
        office_spaces(space_number)
      `)
      .eq('id', bookingData.id)
      .single();

    if (newBooking) {
      // Update state with the new booking
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
    }

    showToast('Boeking succesvol aangemaakt', 'success');
    setShowForm(false);
    setSelectedCells([]);
    setFormData({ tenant_id: '', room_id: '' });
    if (onBookingChange) {
      onBookingChange();
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

  const handlePinVerification = () => {
    // Check if any tenant has this PIN code
    const validTenant = tenants.find(t => t.booking_pin_code === pinInput);
    if (validTenant) {
      setIsPinVerified(true);
      setVerifiedTenantId(validTenant.id);
      setShowPinModal(false);
      setPinInput('');
    } else {
      showToast('Onjuiste PIN-code. Neem contact op met de beheerder.', 'error');
      setPinInput('');
    }
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDeleteConfirm(true);
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;

    const { error } = await supabase
      .from('meeting_room_bookings')
      .update({ status: 'cancelled' })
      .eq('id', selectedBooking.id);

    if (error) {
      console.error('Error cancelling booking:', error);
      showToast('Fout bij het annuleren van de boeking', 'error');
      return;
    }

    // Remove the cancelled booking from state
    setWeekDays(prev => prev.map(day => ({
      ...day,
      bookings: day.bookings.filter(b => b.id !== selectedBooking.id)
    })));

    showToast('Boeking succesvol geannuleerd', 'success');
    setShowDeleteConfirm(false);
    setSelectedBooking(null);
    if (onBookingChange) {
      onBookingChange();
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

  // On production, show PIN modal first
  if (isProduction && !isPinVerified) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        {showPinModal && (
          <div className="bg-dark-800 rounded-lg p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gold-500 mb-2">Welkom bij HAL5 Overloon</h2>
              <p className="text-gray-300">Voer je PIN-code in om een vergaderruimte te boeken</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  PIN-code
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePinVerification();
                    }
                  }}
                  className="w-full px-4 py-3 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent text-center text-xl tracking-wider"
                  placeholder="••••"
                  autoFocus
                />
              </div>

              <button
                onClick={handlePinVerification}
                className="w-full px-6 py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 transition-colors font-semibold"
              >
                Verifiëren
              </button>

              <p className="text-sm text-gray-400 text-center mt-4">
                Geen PIN-code? Neem contact op met de beheerder.
              </p>
            </div>
          </div>
        )}
      </div>
    );
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
                className="p-1 hover:bg-gray-700 rounded"
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
                className="p-1 hover:bg-gray-700 rounded"
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
                      className={`text-xs py-1 rounded ${
                        isSelected
                          ? 'bg-blue-600 text-white font-semibold'
                          : isTodayDate
                          ? 'bg-blue-900/50 text-blue-300 font-semibold'
                          : !dayInfo.isCurrentMonth
                          ? 'text-gray-600 hover:bg-gray-700 cursor-pointer'
                          : 'text-gray-300 hover:bg-gray-700 cursor-pointer'
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

      <div className="flex gap-4 h-[calc(100vh-100px)] max-h-[900px] w-full">
        {/* Left Sidebar - Month Calendars */}
      <div className="w-72 bg-gray-800 rounded-lg p-4 flex-shrink-0 overflow-y-auto">
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
          className="w-full px-3 py-2 text-sm bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
        >
          Vandaag
        </button>
      </div>

      {/* Right Side - Week View */}
      <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-700 px-4 py-3 flex items-center justify-between border-b border-gray-600">
          <div className="flex items-center gap-3">
            <button
              onClick={previousWeek}
              className="p-1 hover:bg-gray-600 rounded"
            >
              <ChevronLeft size={18} className="text-gray-300" />
            </button>
            <h2 className="text-base font-semibold text-gray-100">{weekRange}</h2>
            <button
              onClick={nextWeek}
              className="p-1 hover:bg-gray-600 rounded"
            >
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          </div>
          <div className="text-sm text-gray-400">Week</div>
        </div>

        {/* Calendar Grid */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-gray-900">
          <div className="min-w-[900px]" style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)' }}>
            {/* Header row */}
            <div className="sticky top-0 z-20 bg-gray-700 border-b border-gray-600" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div className="p-2"></div>
              {weekDays.map((day) => {
                const isTodayDate = isToday(day.date);
                return (
                  <div
                    key={day.dateStr}
                    className={`p-2 text-center border-l border-gray-600 ${
                      isTodayDate ? 'bg-blue-900/30' : ''
                    }`}
                  >
                    <div className="text-xs text-gray-400 uppercase">
                      {day.date.toLocaleDateString('nl-NL', { weekday: 'short' })}
                    </div>
                    <div className={`text-2xl font-light ${
                      isTodayDate ? 'text-blue-400' : 'text-gray-200'
                    }`}>
                      {day.date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time column */}
            <div className="bg-gray-800">
              {timeSlots.map((time) => {
                const [hour] = time.split(':').map(Number);
                // Only show on the hour
                const showTime = time.endsWith(':00');
                return (
                  <div
                    key={time}
                    className="text-[10px] text-gray-500 bg-gray-800 pr-2 text-right border-b border-gray-700"
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
              <div key={day.dateStr} className={`relative border-l border-gray-600 ${isTodayDate ? 'bg-blue-900/10' : 'bg-gray-900'}`}>
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
                        !hasBookingHere && !isPast ? 'cursor-pointer hover:bg-gray-800/50' : ''
                      } ${isSelected ? 'bg-yellow-200/40 border-2 border-yellow-400' : ''} ${isPast ? 'bg-gray-900/50' : isWorkHours ? 'bg-slate-700/30' : ''} ${isDraggingBooking && !hasBookingHere && !isPast ? 'bg-green-900/20' : ''}`}
                      style={{ height: `${CELL_HEIGHT}px` }}
                      onMouseDown={(e) => {
                        if (!isDraggingBooking) {
                          handleCellMouseDown(day.dateStr, time);
                        }
                      }}
                      onMouseEnter={() => {
                        if (!isDraggingBooking) {
                          handleCellMouseEnter(day.dateStr, time);
                        }
                      }}
                      onMouseUp={() => {
                        if (isDraggingBooking && !hasBookingHere && !isPast) {
                          handleBookingDrop(day.dateStr, time);
                        }
                      }}
                    >
                      {booking && (() => {
                        const colors = getTenantColor(booking.tenant_id);
                        const isBeingDragged = draggedBooking?.id === booking.id;
                        const isCompleted = booking.status === 'completed';
                        return (
                          <div
                            className={`absolute left-1 right-1 ${colors.bg} border-l-4 ${colors.border} rounded shadow-sm px-2 py-1 overflow-hidden z-10 cursor-move hover:shadow-md transition-shadow select-none ${isBeingDragged ? 'opacity-50' : isCompleted ? 'opacity-70' : ''}`}
                            style={{
                              height: `${getBookingHeight(booking) * CELL_HEIGHT - 2}px`,
                              top: '1px'
                            }}
                            title={`${booking.office_spaces?.space_number} - ${booking.tenants?.company_name || ''} (${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)})${isCompleted ? ' - Voltooid' : ''}${booking.invoice_id ? ' - Gefactureerd' : ''}\nKlik om te beheren, sleep om te verplaatsen`}
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
                            <div className={`font-semibold ${colors.text} text-xs mb-0.5`}>
                              {booking.office_spaces?.space_number}
                            </div>
                            <div className={`${colors.text} text-[11px] opacity-90`}>
                              {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                            </div>
                            <div className={`${colors.text} truncate text-[11px] opacity-80 mt-0.5`}>
                              {booking.tenants?.company_name || ''}
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
                const endTime = timeSlots[endIndex] || '23:59';
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
                    {!isProduction && formData.room_id && (
                      <p className="text-gray-300">
                        <strong>Kosten:</strong> €{totalAmount.toFixed(2)} (€{hourlyRate}/uur)
                      </p>
                    )}
                  </div>
                );
              })()}

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
                      {room.space_number} {!isProduction && room.hourly_rate && `(€${room.hourly_rate}/u)`}
                    </option>
                  ))}
                </select>
              </div>

              {isProduction && verifiedTenantId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Bedrijf
                  </label>
                  <div className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-700 text-gray-100">
                    {tenants.find(t => t.id === verifiedTenantId)?.company_name ||
                     tenants.find(t => t.id === verifiedTenantId)?.name || 'Onbekend'}
                  </div>
                </div>
              ) : (
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
              )}

              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setSelectedCells([]);
                    setFormData({ tenant_id: '', room_id: '' });
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
                    (!isProduction && !formData.tenant_id) ||
                    (isProduction && !verifiedTenantId)
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
          <div className="bg-dark-800 rounded-lg p-6 max-w-md w-full">
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
              <p><strong>Bedrijf:</strong> {selectedBooking.tenants?.company_name || selectedBooking.tenants?.name}</p>
              <p><strong>Datum:</strong> {new Date(selectedBooking.booking_date + 'T00:00:00').toLocaleDateString('nl-NL')}</p>
              <p><strong>Tijd:</strong> {selectedBooking.start_time.substring(0, 5)} - {selectedBooking.end_time.substring(0, 5)}</p>
              {selectedBooking.invoice_id && (
                <p className="text-amber-500"><strong>Let op:</strong> Deze boeking is al gefactureerd</p>
              )}
            </div>

            <div className="space-y-3">
              {selectedBooking.status !== 'cancelled' && (
                <button
                  onClick={handleCancelBooking}
                  className="w-full px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Boeking Annuleren
                </button>
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
      </div>
    </div>
  );
}
