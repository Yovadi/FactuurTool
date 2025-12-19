import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, Circle, AlertCircle, Copy, Wand2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FlexDayBookingProps {
  leaseId: string;
  spaceId: string;
  spaceName: string;
  tenantName: string;
  creditsPerMonth: number;
  dayType: 'full_day' | 'half_day';
  startDate: string;
  endDate: string | null;
  onClose: () => void;
}

interface Booking {
  id: string;
  booking_date: string;
  is_half_day: boolean;
}

interface FlexSchedule {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
}

export default function FlexDayBooking({
  leaseId,
  spaceId,
  spaceName,
  tenantName,
  creditsPerMonth,
  dayType,
  startDate,
  endDate,
  onClose
}: FlexDayBookingProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [flexSchedule, setFlexSchedule] = useState<FlexSchedule | null>(null);
  const [applyingPattern, setApplyingPattern] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    loadBookings();
    loadFlexSchedule();
  }, [leaseId, spaceId, year, month]);

  const loadFlexSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('flex_schedules')
        .select('monday, tuesday, wednesday, thursday, friday')
        .eq('lease_id', leaseId)
        .eq('space_id', spaceId)
        .maybeSingle();

      if (error) throw error;
      setFlexSchedule(data);
    } catch (error) {
      console.error('Error loading flex schedule:', error);
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const firstDayStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
      const lastDayStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('flex_day_bookings')
        .select('*')
        .eq('lease_id', leaseId)
        .eq('space_id', spaceId)
        .gte('booking_date', firstDayStr)
        .lte('booking_date', lastDayStr)
        .order('booking_date');

      if (error) throw error;

      setBookings(data || []);
      calculateCreditsUsed(data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
      alert('Fout bij laden van boekingen');
    } finally {
      setLoading(false);
    }
  };

  const calculateCreditsUsed = (currentBookings: Booking[]) => {
    const used = currentBookings.reduce((total, booking) => {
      if (dayType === 'half_day' && booking.is_half_day) {
        return total + 0.5;
      }
      return total + 1;
    }, 0);
    setCreditsUsed(used);
  };

  const toggleBooking = async (date: Date, isHalfDay: boolean = false) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const existingBooking = bookings.find(b => b.booking_date === dateStr);

    try {
      if (existingBooking) {
        setBookings(prev => prev.filter(b => b.id !== existingBooking.id));
        calculateCreditsUsed(bookings.filter(b => b.id !== existingBooking.id));

        const { error } = await supabase
          .from('flex_day_bookings')
          .delete()
          .eq('id', existingBooking.id);

        if (error) throw error;
      } else {
        const creditCost = (dayType === 'half_day' && isHalfDay) ? 0.5 : 1;
        if (creditsUsed + creditCost > creditsPerMonth) {
          alert(`Je hebt maar ${creditsPerMonth} dagen per maand. Je hebt al ${creditsUsed} dag(en) gebruikt.`);
          return;
        }

        const tempId = `temp-${Date.now()}`;
        const newBooking: Booking = {
          id: tempId,
          booking_date: dateStr,
          is_half_day: isHalfDay
        };

        setBookings(prev => [...prev, newBooking]);
        calculateCreditsUsed([...bookings, newBooking]);

        const { data, error } = await supabase
          .from('flex_day_bookings')
          .insert({
            lease_id: leaseId,
            space_id: spaceId,
            booking_date: dateStr,
            is_half_day: isHalfDay
          })
          .select()
          .single();

        if (error) throw error;

        setBookings(prev => prev.map(b => b.id === tempId ? data : b));
      }
    } catch (error: any) {
      console.error('Error toggling booking:', error);
      if (error.message?.includes('credit limit')) {
        alert(error.message);
      } else {
        alert('Fout bij opslaan van boeking');
      }
      await loadBookings();
    }
  };

  const getDaysInMonth = () => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    const adjustedStart = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    for (let i = 0; i < adjustedStart; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const isBooked = (date: Date): Booking | undefined => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return bookings.find(b => b.booking_date === dateStr);
  };

  const isPastDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const getDayName = (date: Date): keyof FlexSchedule => {
    const dayIndex = date.getDay();
    const dayNames: (keyof FlexSchedule)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    if (dayIndex === 0) return 'friday';
    if (dayIndex === 6) return 'friday';
    return dayNames[dayIndex - 1];
  };

  const applyPatternToEntireContract = async () => {
    if (!flexSchedule) {
      alert('Er is geen vast patroon ingesteld voor deze flexer in deze ruimte.');
      return;
    }

    const contractStart = new Date(startDate);
    const contractEnd = endDate ? new Date(endDate) : new Date(contractStart.getFullYear() + 10, 11, 31);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startFrom = contractStart > today ? contractStart : today;

    if (!confirm(`Dit vult automatisch ALLE maanden van het contract volgens het vaste patroon, vanaf ${startFrom.toLocaleDateString('nl-NL')} tot ${contractEnd.toLocaleDateString('nl-NL')}. Bestaande boekingen blijven behouden. Doorgaan?`)) {
      return;
    }

    setApplyingPattern(true);
    try {
      const { data: existingBookings, error: fetchError } = await supabase
        .from('flex_day_bookings')
        .select('booking_date')
        .eq('lease_id', leaseId)
        .eq('space_id', spaceId)
        .gte('booking_date', startFrom.toISOString().split('T')[0])
        .lte('booking_date', contractEnd.toISOString().split('T')[0]);

      if (fetchError) throw fetchError;

      const existingDates = new Set(existingBookings?.map(b => b.booking_date) || []);
      const bookingsToCreate = [];

      let currentDate = new Date(startFrom);
      while (currentDate <= contractEnd) {
        const dayName = getDayName(currentDate);
        const dayIndex = currentDate.getDay();

        if (dayIndex !== 0 && dayIndex !== 6 && flexSchedule[dayName]) {
          const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

          if (!existingDates.has(dateStr)) {
            bookingsToCreate.push({
              lease_id: leaseId,
              space_id: spaceId,
              booking_date: dateStr,
              is_half_day: false
            });
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (bookingsToCreate.length === 0) {
        alert('Alle dagen volgens het patroon zijn al geboekt voor de hele contractperiode.');
        return;
      }

      const batchSize = 100;
      for (let i = 0; i < bookingsToCreate.length; i += batchSize) {
        const batch = bookingsToCreate.slice(i, i + batchSize);
        const { error } = await supabase
          .from('flex_day_bookings')
          .insert(batch);

        if (error) throw error;
      }

      await loadBookings();
      alert(`${bookingsToCreate.length} dag(en) succesvol geboekt voor de hele contractperiode!`);
    } catch (error: any) {
      console.error('Error applying pattern:', error);
      alert('Fout bij toepassen van patroon: ' + (error.message || 'Onbekende fout'));
    } finally {
      setApplyingPattern(false);
    }
  };

  const applyPatternToMonth = async () => {
    if (!flexSchedule) {
      alert('Er is geen vast patroon ingesteld voor deze flexer in deze ruimte.');
      return;
    }

    if (!confirm('Dit vult automatisch alle dagen in deze maand op basis van het vaste patroon. Bestaande boekingen blijven behouden. Doorgaan?')) {
      return;
    }

    setApplyingPattern(true);
    try {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const bookingsToCreate = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayName = getDayName(date);
        const dayIndex = date.getDay();

        if (dayIndex === 0 || dayIndex === 6) continue;
        if (!flexSchedule[dayName]) continue;
        if (isPastDate(date)) continue;

        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const alreadyBooked = bookings.some(b => b.booking_date === dateStr);

        if (!alreadyBooked) {
          bookingsToCreate.push({
            lease_id: leaseId,
            space_id: spaceId,
            booking_date: dateStr,
            is_half_day: false
          });
        }
      }

      if (bookingsToCreate.length === 0) {
        alert('Alle dagen volgens het patroon zijn al geboekt of liggen in het verleden.');
        return;
      }

      const { error } = await supabase
        .from('flex_day_bookings')
        .insert(bookingsToCreate);

      if (error) throw error;

      await loadBookings();
      alert(`${bookingsToCreate.length} dag(en) succesvol geboekt volgens het vaste patroon!`);
    } catch (error: any) {
      console.error('Error applying pattern:', error);
      alert('Fout bij toepassen van patroon: ' + (error.message || 'Onbekende fout'));
    } finally {
      setApplyingPattern(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ];

  const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  const creditsRemaining = creditsPerMonth - creditsUsed;
  const usagePercentage = (creditsUsed / creditsPerMonth) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-dark-700">
        <div className="sticky top-0 bg-dark-800 border-b border-dark-700 p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-100">{tenantName}</h2>
              <p className="text-gray-400 mt-1">{spaceName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-gold-500" />
                <span className="font-medium text-gray-200">Maandelijks Tegoed</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-100">
                  {creditsUsed} / {creditsPerMonth}
                </div>
                <div className="text-sm text-gray-400">
                  {dayType === 'half_day' ? 'dagen/halve dagen' : 'dagen'}
                </div>
              </div>
            </div>

            <div className="relative w-full h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className={`absolute top-0 left-0 h-full transition-all ${
                  usagePercentage >= 100
                    ? 'bg-red-500'
                    : usagePercentage >= 80
                    ? 'bg-yellow-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-gray-400">
                Nog {creditsRemaining} {creditsRemaining === 1 ? 'dag' : 'dagen'} beschikbaar
              </span>
              {usagePercentage >= 100 && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertCircle size={14} />
                  Limiet bereikt
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} className="text-gray-400" />
              </button>
              <h3 className="text-xl font-bold text-gray-100">
                {monthNames[month]} {year}
              </h3>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <ChevronRight size={20} className="text-gray-400" />
              </button>
            </div>

            {flexSchedule && (
              <div className="mb-6 space-y-3">
                <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-300">Vast patroon voor contract:</span>
                  </div>
                  <div className="flex gap-2 justify-center">
                    {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const).map((day, idx) => {
                      const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
                      return (
                        <div
                          key={day}
                          className={`px-3 py-2 rounded-lg text-sm font-medium ${
                            flexSchedule[day]
                              ? 'bg-gold-500 text-white'
                              : 'bg-dark-700 text-gray-500'
                          }`}
                        >
                          {dayLabels[idx]}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 text-center">
                    Dit patroon is ingesteld bij "Bezetting" → "Vaste dagen in deze ruimte"
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={applyPatternToEntireContract}
                    disabled={applyingPattern}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Wand2 size={16} />
                    {applyingPattern ? 'Bezig...' : 'Hele contract'}
                  </button>
                  <button
                    onClick={applyPatternToMonth}
                    disabled={applyingPattern}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar size={16} />
                    {applyingPattern ? 'Bezig...' : 'Alleen deze maand'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-7 gap-2 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">Laden...</div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {getDaysInMonth().map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }

                  const booking = isBooked(date);
                  const isPast = isPastDate(date);
                  const isToday = date.toDateString() === new Date().toDateString();

                  return (
                    <button
                      key={index}
                      onClick={() => !isPast && toggleBooking(date)}
                      disabled={isPast}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all relative ${
                        isPast
                          ? 'bg-dark-800 text-gray-600 cursor-not-allowed'
                          : booking
                          ? 'bg-gold-500 text-white hover:bg-gold-600'
                          : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                      } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <span className="text-lg font-medium">{date.getDate()}</span>
                      {booking && (
                        <div className="absolute top-1 right-1">
                          <CheckCircle2 size={14} />
                        </div>
                      )}
                      {booking && booking.is_half_day && (
                        <span className="text-xs mt-1">½</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-dark-700 space-y-4">
              <div className="flex items-start gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gold-500 rounded" />
                  <span className="text-gray-400">Geboekt</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-dark-700 rounded" />
                  <span className="text-gray-400">Beschikbaar</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-dark-800 rounded" />
                  <span className="text-gray-400">Verleden</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 rounded" />
                  <span className="text-gray-400">Vandaag</span>
                </div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-sm text-blue-300">
                  <strong>Tip:</strong> Gebruik "Hele contract" om de volledige contractperiode in één keer te vullen,
                  of gebruik "Alleen deze maand" voor specifieke maanden.
                  Klik daarna individuele dagen aan/uit om uitzonderingen te maken.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
