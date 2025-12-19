import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Wand2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Toast } from './Toast';
import { ConfirmModal } from './ConfirmModal';

interface FlexDayBookingProps {
  leaseId: string;
  spaceId: string;
  spaceName: string;
  tenantName: string;
  creditsPerWeek: number;
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

type ToastMessage = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
};

type ConfirmDialog = {
  title: string;
  message: string;
  onConfirm: () => void;
  variant?: 'default' | 'danger';
} | null;

function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthEnd(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function FlexDayBooking({
  leaseId,
  spaceId,
  spaceName,
  tenantName,
  creditsPerWeek,
  dayType,
  startDate,
  endDate,
  onClose
}: FlexDayBookingProps) {
  const [currentMonth, setCurrentMonth] = useState(getMonthStart(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [flexSchedule, setFlexSchedule] = useState<FlexSchedule | null>(null);
  const [applyingPattern, setApplyingPattern] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const translateError = (error: any): string => {
    const message = error?.message || '';

    if (message.includes('exceed weekly credit limit') || message.includes('exceed monthly credit limit')) {
      return `Je hebt de limiet van ${creditsPerWeek} dagen per week bereikt`;
    }

    if (message.includes('credit limit')) {
      return 'Limiet bereikt';
    }

    return 'Er ging iets mis bij het opslaan';
  };

  useEffect(() => {
    loadBookings();
    loadFlexSchedule();
  }, [leaseId, spaceId, currentMonth]);

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
      const monthEnd = getMonthEnd(currentMonth);
      const firstDayStr = formatDateStr(currentMonth);
      const lastDayStr = formatDateStr(monthEnd);

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
      showToast('Fout bij laden van boekingen', 'error');
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
    const dateStr = formatDateStr(date);
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
        if (creditsUsed + creditCost > creditsPerWeek) {
          showToast(`Je hebt maar ${creditsPerWeek} dagen per week. Je hebt al ${creditsUsed} dag(en) gebruikt.`, 'error');
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
      showToast(translateError(error), 'error');
      await loadBookings();
    }
  };

  const getMonthDays = (): Date[] => {
    const days: Date[] = [];
    const monthEnd = getMonthEnd(currentMonth);
    const totalDays = monthEnd.getDate();

    for (let i = 1; i <= totalDays; i++) {
      const day = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      days.push(day);
    }
    return days;
  };

  const isBooked = (date: Date): Booking | undefined => {
    const dateStr = formatDateStr(date);
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

  const applyPatternToMonth = () => {
    if (!flexSchedule) {
      showToast('Er is geen vast patroon ingesteld voor deze flexer in deze ruimte.', 'error');
      return;
    }

    const monthEnd = getMonthEnd(currentMonth);
    setConfirmDialog({
      title: 'Maand invullen',
      message: `Dit vult automatisch de maand ${currentMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })} op basis van het vaste patroon.\n\nBestaande boekingen blijven behouden.`,
      onConfirm: () => executeApplyPatternToMonth()
    });
  };

  const executeApplyPatternToMonth = async () => {
    setConfirmDialog(null);

    if (!flexSchedule) return;

    setApplyingPattern(true);
    try {
      const bookingsToCreate = [];
      const monthDays = getMonthDays();

      for (const date of monthDays) {
        const dayName = getDayName(date);
        const dayIndex = date.getDay();

        if (dayIndex === 0 || dayIndex === 6) continue;
        if (!flexSchedule[dayName]) continue;
        if (isPastDate(date)) continue;

        const dateStr = formatDateStr(date);
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
        showToast('Alle dagen volgens het patroon zijn al geboekt of liggen in het verleden.', 'info');
        return;
      }

      const { error } = await supabase
        .from('flex_day_bookings')
        .insert(bookingsToCreate);

      if (error) throw error;

      await loadBookings();
      showToast(`${bookingsToCreate.length} dag(en) succesvol geboekt volgens het vaste patroon!`, 'success');
    } catch (error: any) {
      console.error('Error applying pattern:', error);
      showToast(translateError(error), 'error');
    } finally {
      setApplyingPattern(false);
    }
  };

  const applyPatternToEntireContract = () => {
    if (!flexSchedule) {
      showToast('Er is geen vast patroon ingesteld voor deze flexer in deze ruimte.', 'error');
      return;
    }

    const contractStart = new Date(startDate);
    const contractEnd = endDate ? new Date(endDate) : new Date(contractStart.getFullYear() + 10, 11, 31);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startFrom = contractStart > today ? contractStart : today;

    setConfirmDialog({
      title: 'Hele contract invullen',
      message: `Dit vult automatisch ALLE weken van het contract volgens het vaste patroon:\n\nVan: ${startFrom.toLocaleDateString('nl-NL')}\nTot: ${contractEnd.toLocaleDateString('nl-NL')}\n\nBestaande boekingen blijven behouden.`,
      onConfirm: () => executeApplyPatternToEntireContract()
    });
  };

  const executeApplyPatternToEntireContract = async () => {
    setConfirmDialog(null);

    if (!flexSchedule) return;

    const contractStart = new Date(startDate);
    const contractEnd = endDate ? new Date(endDate) : new Date(contractStart.getFullYear() + 10, 11, 31);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startFrom = contractStart > today ? contractStart : today;

    setApplyingPattern(true);
    try {
      const { data: existingBookings, error: fetchError } = await supabase
        .from('flex_day_bookings')
        .select('booking_date')
        .eq('lease_id', leaseId)
        .eq('space_id', spaceId)
        .gte('booking_date', formatDateStr(startFrom))
        .lte('booking_date', formatDateStr(contractEnd));

      if (fetchError) throw fetchError;

      const existingDates = new Set(existingBookings?.map(b => b.booking_date) || []);
      const bookingsToCreate = [];

      let currentDate = new Date(startFrom);
      while (currentDate <= contractEnd) {
        const dayName = getDayName(currentDate);
        const dayIndex = currentDate.getDay();

        if (dayIndex !== 0 && dayIndex !== 6 && flexSchedule[dayName]) {
          const dateStr = formatDateStr(currentDate);

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
        showToast('Alle dagen volgens het patroon zijn al geboekt voor de hele contractperiode.', 'info');
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
      showToast(`${bookingsToCreate.length} dag(en) succesvol geboekt voor de hele contractperiode!`, 'success');
    } catch (error: any) {
      console.error('Error applying pattern:', error);
      showToast(translateError(error), 'error');
    } finally {
      setApplyingPattern(false);
    }
  };

  const goToPreviousMonth = () => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    setCurrentMonth(getMonthStart(prev));
  };

  const goToNextMonth = () => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentMonth(getMonthStart(next));
  };

  const creditsRemaining = creditsPerWeek - creditsUsed;
  const usagePercentage = (creditsUsed / creditsPerWeek) * 100;

  const weeksInMonth = Math.ceil(getMonthEnd(currentMonth).getDate() / 7);
  const totalMonthlyCredits = creditsPerWeek * weeksInMonth;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg max-w-2xl w-full max-h-[88vh] overflow-hidden border border-dark-700 flex flex-col">
        <div className="bg-dark-800 border-b border-dark-700 p-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold text-gray-100">{tenantName}</h2>
              <p className="text-gray-400 text-sm">{spaceName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="bg-dark-900 rounded-lg p-2.5 border border-dark-700">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gold-500" />
                <span className="text-sm font-medium text-gray-200">Maand Overzicht</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-100">
                  {creditsUsed} dagen gebruikt
                </div>
                <div className="text-xs text-gray-400">
                  {creditsPerWeek} dagen per week beschikbaar
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-400 text-center py-1">
              De wekelijkse limiet van {creditsPerWeek} {creditsPerWeek === 1 ? 'dag' : 'dagen'} wordt automatisch gecontroleerd bij elke boeking
            </div>
          </div>
        </div>

        <div className="p-3 overflow-y-auto flex-1">
          <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={goToPreviousMonth}
                className="p-1.5 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <ChevronLeft size={18} className="text-gray-400" />
              </button>
              <div className="text-center">
                <h3 className="text-base font-bold text-gray-100">
                  {currentMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
                </h3>
              </div>
              <button
                onClick={goToNextMonth}
                className="p-1.5 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            </div>

            {flexSchedule && (
              <div className="mb-3 space-y-2">
                <div className="bg-dark-800 rounded-lg p-2.5 border border-dark-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">Vast patroon voor contract:</span>
                  </div>
                  <div className="flex gap-1.5 justify-center">
                    {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const).map((day, idx) => {
                      const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
                      return (
                        <div
                          key={day}
                          className={`px-2.5 py-1.5 rounded text-xs font-medium ${
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
                  <div className="text-xs text-gray-500 mt-1.5 text-center">
                    Dit patroon is ingesteld bij "Bezetting" → "Vaste dagen in deze ruimte"
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={applyPatternToMonth}
                    disabled={applyingPattern}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar size={14} />
                    {applyingPattern ? 'Bezig...' : 'Alleen deze maand'}
                  </button>
                  <button
                    onClick={applyPatternToEntireContract}
                    disabled={applyingPattern}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Wand2 size={14} />
                    {applyingPattern ? 'Bezig...' : 'Hele contract'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                  {day}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm">Laden...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const monthDays = getMonthDays();
                  const firstDay = monthDays[0];
                  const firstDayOfWeek = firstDay.getDay();
                  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

                  const cells = [];

                  for (let i = 0; i < offset; i++) {
                    cells.push(
                      <div key={`empty-${i}`} className="h-12" />
                    );
                  }

                  monthDays.forEach((date, index) => {
                    const booking = isBooked(date);
                    const isPast = isPastDate(date);
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                    cells.push(
                      <button
                        key={`day-${index}`}
                        onClick={() => !isPast && !isWeekend && toggleBooking(date)}
                        disabled={isPast || isWeekend}
                        className={`w-full h-12 rounded-lg flex flex-col items-center justify-center transition-all relative ${
                          isWeekend
                            ? 'bg-dark-800/50 text-gray-600 cursor-not-allowed'
                            : isPast
                            ? 'bg-dark-800 text-gray-600 cursor-not-allowed'
                            : booking
                            ? 'bg-gold-500 text-white hover:bg-gold-600'
                            : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                        } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        <span className="text-sm font-bold">{date.getDate()}</span>
                        {booking && (
                          <div className="absolute top-0.5 right-0.5">
                            <CheckCircle2 size={10} />
                          </div>
                        )}
                        {booking && booking.is_half_day && (
                          <span className="text-[9px] mt-0.5">½</span>
                        )}
                      </button>
                    );
                  });

                  return cells;
                })()}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-dark-700 space-y-2.5">
              <div className="flex items-start gap-3 text-xs flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-gold-500 rounded" />
                  <span className="text-gray-400">Geboekt</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-dark-700 rounded" />
                  <span className="text-gray-400">Beschikbaar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-dark-800 rounded" />
                  <span className="text-gray-400">Verleden</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-blue-500 rounded" />
                  <span className="text-gray-400">Vandaag</span>
                </div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                <p className="text-xs text-blue-300">
                  <strong>Tip:</strong> Gebruik "Alleen deze maand" om de huidige maand in te vullen volgens het vaste patroon,
                  of gebruik "Hele contract" om de volledige contractperiode in één keer te vullen.
                  Klik daarna individuele dagen aan/uit om uitzonderingen te maken.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          variant={confirmDialog.variant}
        />
      )}
    </div>
  );
}
