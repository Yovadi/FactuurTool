import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Booking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  tenants?: { name: string };
  office_spaces?: { space_number: string };
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  bookings: Booking[];
};

export function BookingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, [currentDate]);

  const loadBookings = async () => {
    setLoading(true);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const formatLocalDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const { data } = await supabase
      .from('meeting_room_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        tenants(name),
        office_spaces(space_number)
      `)
      .gte('booking_date', formatLocalDate(startDate))
      .lte('booking_date', formatLocalDate(endDate))
      .neq('status', 'cancelled')
      .order('start_time');

    setBookings(data || []);

    const days: CalendarDay[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayBookings = (data || []).filter(b => b.booking_date === dateStr);

      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === currentDate.getMonth(),
        bookings: dayBookings
      });

      current.setDate(current.getDate() + 1);
    }

    setCalendarDays(days);
    setLoading(false);
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

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const monthYear = currentDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });

  if (loading) {
    return <div className="text-center py-8 text-gray-300">Kalender laden...</div>;
  }

  return (
    <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-100 capitalize">{monthYear}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            Vandaag
          </button>
          <button
            onClick={previousMonth}
            className="p-2 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'].map((day) => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-gray-400 py-2"
          >
            {day}
          </div>
        ))}

        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`min-h-[100px] border border-dark-700 rounded-lg p-2 ${
              !day.isCurrentMonth ? 'bg-dark-950 opacity-50' : 'bg-dark-800'
            } ${isToday(day.date) ? 'ring-2 ring-gold-500' : ''}`}
          >
            <div className={`text-sm font-semibold mb-1 ${
              isToday(day.date) ? 'text-gold-500' : 'text-gray-300'
            }`}>
              {day.date.getDate()}
            </div>
            <div className="space-y-1">
              {day.bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="text-xs bg-blue-900/50 text-blue-300 rounded p-1 truncate"
                  title={`${booking.office_spaces?.space_number} - ${booking.tenants?.name} (${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)})`}
                >
                  <div className="font-semibold truncate">{booking.start_time.substring(0, 5)}</div>
                  <div className="truncate">{booking.tenants?.name}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-900/50 border border-blue-700 rounded"></div>
          <span className="text-gray-300">Boeking</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 ring-2 ring-gold-500 rounded"></div>
          <span className="text-gray-300">Vandaag</span>
        </div>
      </div>
    </div>
  );
}
