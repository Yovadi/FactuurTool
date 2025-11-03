import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Booking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
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
    notes: ''
  });

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
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, selectedCells]);

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
        .select('id, name, company_name')
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
    setMeetingRooms(spacesRes.data || []);
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
    if (!selectedRoom) {
      alert('Selecteer eerst een vergaderruimte');
      return;
    }

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

    if (selectedCells.length === 0 || !selectedRoom) return;

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
    const hourlyRate = selectedRoom.hourly_rate || 25;
    const totalAmount = totalHours * hourlyRate;

    const { error } = await supabase
      .from('meeting_room_bookings')
      .insert({
        space_id: selectedRoom.id,
        tenant_id: formData.tenant_id,
        booking_date: selectedCells[0].date,
        start_time: startTime,
        end_time: endTime,
        hourly_rate: hourlyRate,
        total_hours: totalHours,
        total_amount: totalAmount,
        status: 'confirmed',
        notes: formData.notes
      });

    if (error) {
      console.error('Error creating booking:', error);
      alert('Fout bij het aanmaken van de boeking');
      return;
    }

    setShowForm(false);
    setSelectedCells([]);
    setFormData({ tenant_id: '', notes: '' });
    loadData();
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

      <div className="mb-4 flex gap-2 flex-wrap">
        {meetingRooms.map((room) => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room)}
            className={`px-4 py-2 rounded-lg border-2 transition-colors ${
              selectedRoom?.id === room.id
                ? 'bg-gold-600 border-gold-600 text-white'
                : 'bg-dark-800 border-dark-600 text-gray-300 hover:border-gold-600'
            }`}
          >
            {room.space_number} {room.hourly_rate && `(€${room.hourly_rate}/u)`}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto max-h-[calc(100vh-350px)] overflow-y-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 gap-px bg-dark-700 sticky top-0 z-20">
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

          <div className="grid grid-cols-8 gap-px bg-dark-700">
            <div className="bg-dark-900">
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="text-xs text-gray-500 bg-dark-900 px-1"
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
                      className={`border-t border-dark-700 relative ${
                        !hasBookingHere && !isPast ? 'cursor-pointer hover:bg-gold-900/20' : ''
                      } ${isSelected ? 'bg-gold-600/50 border border-gold-500' : ''} ${isPast ? 'bg-dark-900/50' : ''}`}
                      style={{ height: `${CELL_HEIGHT}px` }}
                      onMouseDown={() => handleCellMouseDown(day.dateStr, time)}
                      onMouseEnter={() => handleCellMouseEnter(day.dateStr, time)}
                    >
                      {booking && (
                        <div
                          className="absolute left-0 right-0 mx-0.5 bg-gold-600 border border-gold-500 rounded px-1 overflow-hidden z-10"
                          style={{
                            height: `${getBookingHeight(booking) * CELL_HEIGHT}px`,
                            top: 0
                          }}
                          title={`${booking.office_spaces?.space_number} - ${booking.tenants?.company_name || ''} (${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)})`}
                        >
                          <div className="font-semibold text-dark-900 leading-tight text-[10px]">
                            {booking.start_time.substring(0, 5)}
                          </div>
                          <div className="text-dark-900 truncate leading-tight text-[10px]">
                            {booking.tenants?.company_name || ''}
                          </div>
                        </div>
                      )}
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
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Bedrijf
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

              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setSelectedCells([]);
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
    </div>
  );
}
