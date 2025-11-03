import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

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

export function BookingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);
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
    loadData();
  }, [currentDate]);

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
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const loadData = async () => {
    setLoading(true);

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

    setWeekDays(days);
    const rooms = spacesRes.data || [];
    setMeetingRooms(rooms);

    // Automatically select the first room if there's only one
    if (rooms.length === 1 && !selectedRoom) {
      setSelectedRoom(rooms[0]);
    }

    setTenants(tenantsRes.data || []);
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

    if (selectedCells.length === 0 || !formData.room_id) return;

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
        tenant_id: formData.tenant_id,
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
      alert('Fout bij het aanmaken van de boeking');
      return;
    }

    setShowForm(false);
    setSelectedCells([]);
    setFormData({ tenant_id: '', room_id: '' });
    await loadData();
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

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handlePinVerification = () => {
    // Check if any tenant has this PIN code
    const validTenant = tenants.find(t => t.booking_pin_code === pinInput);
    if (validTenant) {
      setIsPinVerified(true);
      setShowPinModal(false);
      setPinInput('');
    } else {
      alert('Onjuiste PIN-code. Neem contact op met de beheerder.');
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
      alert('Fout bij het annuleren van de boeking');
      return;
    }

    setShowDeleteConfirm(false);
    setSelectedBooking(null);
    await loadData();
  };

  const handleDeleteBooking = async () => {
    if (!selectedBooking) return;

    const { error } = await supabase
      .from('meeting_room_bookings')
      .delete()
      .eq('id', selectedBooking.id);

    if (error) {
      console.error('Error deleting booking:', error);
      alert('Fout bij het verwijderen van de boeking');
      return;
    }

    setShowDeleteConfirm(false);
    setSelectedBooking(null);
    await loadData();
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
      alert('Kan geen boeking verplaatsen naar het verleden');
      setDraggedBooking(null);
      setIsDraggingBooking(false);
      return;
    }

    if (hasBooking(dateStr, time)) {
      alert('Er is al een boeking op dit tijdstip');
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
      alert('Boeking past niet meer in de dag');
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
      alert('Fout bij het verplaatsen van de boeking');
    }

    setDraggedBooking(null);
    setIsDraggingBooking(false);
    await loadData();
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

  const weekRange = weekDays.length > 0
    ? `${weekDays[0].date.getDate()} ${weekDays[0].date.toLocaleDateString('nl-NL', { month: 'short' })} - ${weekDays[6].date.getDate()} ${weekDays[6].date.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}`
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

  const CELL_HEIGHT = 28;

  return (
    <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-100">{weekRange}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            Deze week
          </button>
          <button
            onClick={previousWeek}
            className="p-1.5 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={nextWeek}
            className="p-1.5 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[calc(100vh-350px)] overflow-y-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 sticky top-0 z-20">
            <div className="bg-dark-900 p-1.5 text-xs font-semibold text-gray-400">
              Tijd
            </div>
            {weekDays.map((day) => (
              <div
                key={day.dateStr}
                className={`bg-dark-900 p-1.5 text-center ${
                  isToday(day.date) ? 'bg-gold-900/20 border-t-2 border-gold-500' : ''
                }`}
              >
                <div className="text-xs font-semibold text-gray-400">
                  {day.date.toLocaleDateString('nl-NL', { weekday: 'short' })}
                </div>
                <div className={`text-sm font-bold ${
                  isToday(day.date) ? 'text-gold-500' : 'text-gray-100'
                }`}>
                  {day.date.getDate()}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-8">
            <div className="bg-dark-900">
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="text-xs text-gray-500 bg-dark-900 px-1 border-r border-b border-dark-700"
                  style={{ height: `${CELL_HEIGHT}px`, lineHeight: `${CELL_HEIGHT}px` }}
                >
                  {time}
                </div>
              ))}
            </div>

            {weekDays.map((day) => (
              <div key={day.dateStr} className="bg-dark-800 relative">
                {timeSlots.map((time) => {
                  const booking = getBookingAtTime(day.dateStr, time);
                  const hasBookingHere = hasBooking(day.dateStr, time);
                  const isSelected = isCellSelected(day.dateStr, time);

                  const cellDate = new Date(day.dateStr + 'T00:00:00');
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isPast = cellDate < today;

                  return (
                    <div
                      key={time}
                      className={`relative border-r border-b border-dark-700 ${
                        !hasBookingHere && !isPast ? 'cursor-pointer hover:bg-gold-900/20' : ''
                      } ${isSelected ? 'bg-gold-600/50 border border-gold-500' : ''} ${isPast ? 'bg-dark-900/50' : ''} ${isDraggingBooking && !hasBookingHere && !isPast ? 'bg-green-900/20' : ''}`}
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
                        return (
                          <div
                            className={`absolute left-0 right-0 mx-0.5 ${colors.bg} border ${colors.border} rounded px-1 overflow-hidden z-10 cursor-move hover:opacity-90 transition-opacity select-none ${isBeingDragged ? 'opacity-50' : ''}`}
                            style={{
                              height: `${getBookingHeight(booking) * CELL_HEIGHT}px`,
                              top: 0
                            }}
                            title={`${booking.office_spaces?.space_number} - ${booking.tenants?.company_name || ''} (${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)})\nKlik om te beheren, sleep om te verplaatsen`}
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
                            <div className={`font-semibold ${colors.text} leading-tight text-[10px]`}>
                              {booking.start_time.substring(0, 5)}
                            </div>
                            <div className={`${colors.text} truncate leading-tight text-[10px]`}>
                              {booking.tenants?.company_name || ''}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ))}
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
                    {formData.room_id && (
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
                      {room.space_number} {room.hourly_rate && `(€${room.hourly_rate}/u)`}
                    </option>
                  ))}
                </select>
              </div>

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
                  className="px-6 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 transition-colors"
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
                  className="w-full px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Boeking Annuleren
                </button>
              )}
              <button
                onClick={handleDeleteBooking}
                className="w-full px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Boeking Verwijderen
              </button>
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
  );
}
