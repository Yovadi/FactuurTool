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

type WeekDay = {
  date: Date;
  dateStr: string;
  bookings: Booking[];
};

export function BookingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);

  const hours = Array.from({ length: 15 }, (_, i) => i + 7);

  useEffect(() => {
    loadWeekBookings();
  }, [currentDate]);

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

  const loadWeekBookings = async () => {
    setLoading(true);

    const weekStart = getWeekStart(currentDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

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
      .gte('booking_date', formatLocalDate(weekStart))
      .lte('booking_date', formatLocalDate(weekEnd))
      .neq('status', 'cancelled')
      .order('start_time');

    const days: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatLocalDate(date);
      const dayBookings = (data || []).filter(b => b.booking_date === dateStr);

      days.push({
        date,
        dateStr,
        bookings: dayBookings
      });
    }

    setWeekDays(days);
    setLoading(false);
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

  const getBookingForTimeSlot = (dayBookings: Booking[], hour: number) => {
    return dayBookings.filter(booking => {
      const startHour = parseInt(booking.start_time.split(':')[0]);
      const endHour = parseInt(booking.end_time.split(':')[0]);
      const endMinute = parseInt(booking.end_time.split(':')[1]);

      const adjustedEndHour = endMinute > 0 ? endHour + 1 : endHour;

      return hour >= startHour && hour < adjustedEndHour;
    });
  };

  const getBookingHeight = (booking: Booking) => {
    const [startHour, startMinute] = booking.start_time.split(':').map(Number);
    const [endHour, endMinute] = booking.end_time.split(':').map(Number);

    const startInMinutes = startHour * 60 + startMinute;
    const endInMinutes = endHour * 60 + endMinute;
    const durationInHours = (endInMinutes - startInMinutes) / 60;

    return Math.max(durationInHours, 0.5);
  };

  const weekRange = weekDays.length > 0
    ? `${weekDays[0].date.getDate()} ${weekDays[0].date.toLocaleDateString('nl-NL', { month: 'short' })} - ${weekDays[6].date.getDate()} ${weekDays[6].date.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}`
    : '';

  if (loading) {
    return <div className="text-center py-8 text-gray-300">Kalender laden...</div>;
  }

  return (
    <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-100">{weekRange}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            Deze week
          </button>
          <button
            onClick={previousWeek}
            className="p-2 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextWeek}
            className="p-2 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-8 gap-px bg-dark-700">
            <div className="bg-dark-900 p-2 text-xs font-semibold text-gray-400 sticky left-0">
              Tijd
            </div>
            {weekDays.map((day) => (
              <div
                key={day.dateStr}
                className={`bg-dark-900 p-2 text-center ${
                  isToday(day.date) ? 'bg-gold-900/20 border-t-2 border-gold-500' : ''
                }`}
              >
                <div className="text-xs font-semibold text-gray-400">
                  {day.date.toLocaleDateString('nl-NL', { weekday: 'short' })}
                </div>
                <div className={`text-base font-bold ${
                  isToday(day.date) ? 'text-gold-500' : 'text-gray-100'
                }`}>
                  {day.date.getDate()}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-8 gap-px bg-dark-700">
            <div className="bg-dark-900">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-12 border-t border-dark-700 p-1 text-xs text-gray-500 sticky left-0 bg-dark-900"
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {weekDays.map((day) => (
              <div key={day.dateStr} className="bg-dark-800">
                {hours.map((hour) => {
                  const bookingsInSlot = getBookingForTimeSlot(day.bookings, hour);
                  const isFirstSlot = (booking: Booking) => {
                    const startHour = parseInt(booking.start_time.split(':')[0]);
                    return hour === startHour;
                  };

                  return (
                    <div
                      key={hour}
                      className="h-12 border-t border-dark-700 relative"
                    >
                      {bookingsInSlot.map((booking) => {
                        if (!isFirstSlot(booking)) return null;

                        const height = getBookingHeight(booking);

                        return (
                          <div
                            key={booking.id}
                            className="absolute left-0 right-0 mx-0.5 bg-blue-900/70 border border-blue-700 rounded px-1 py-0.5 overflow-hidden z-10 text-xs"
                            style={{
                              height: `${height * 48 - 2}px`,
                              maxHeight: '100%'
                            }}
                            title={`${booking.office_spaces?.space_number} - ${booking.tenants?.name} (${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)})`}
                          >
                            <div className="font-semibold text-blue-200 leading-tight">
                              {booking.start_time.substring(0, 5)}
                            </div>
                            <div className="text-blue-300 truncate leading-tight">
                              {booking.tenants?.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-900/70 border border-blue-700 rounded"></div>
          <span className="text-gray-300">Boeking</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gold-900/20 border-t-2 border-gold-500 rounded"></div>
          <span className="text-gray-300">Vandaag</span>
        </div>
      </div>
    </div>
  );
}
