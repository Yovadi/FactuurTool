import { useState } from 'react';
import { X, Repeat } from 'lucide-react';
import { supabase, type Tenant } from '../lib/supabase';

type RecurringBookingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  spaces: { id: string; space_number: string }[];
  tenants: Tenant[];
  preSelectedTenantId?: string | null;
};

type RecurrenceType = 'daily' | 'weekly' | 'monthly';

const WEEKDAYS = [
  { value: 'monday', label: 'Ma' },
  { value: 'tuesday', label: 'Di' },
  { value: 'wednesday', label: 'Wo' },
  { value: 'thursday', label: 'Do' },
  { value: 'friday', label: 'Vr' },
  { value: 'saturday', label: 'Za' },
  { value: 'sunday', label: 'Zo' }
];

export function RecurringBookingModal({
  isOpen,
  onClose,
  onSuccess,
  spaces,
  tenants,
  preSelectedTenantId = null
}: RecurringBookingModalProps) {
  const [formData, setFormData] = useState({
    space_id: '',
    tenant_id: preSelectedTenantId || '',
    start_time: '09:00',
    end_time: '10:00',
    recurrence_type: 'weekly' as RecurrenceType,
    recurrence_days: [] as string[],
    recurrence_date: 1,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: ''
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.space_id || !formData.tenant_id) {
      setError('Selecteer een ruimte en huurder');
      return;
    }

    if (formData.recurrence_type === 'weekly' && formData.recurrence_days.length === 0) {
      setError('Selecteer minimaal één dag');
      return;
    }

    setGenerating(true);

    try {
      const { data: pattern, error: patternError } = await supabase
        .from('recurring_booking_patterns')
        .insert({
          space_id: formData.space_id,
          tenant_id: formData.tenant_id,
          start_time: formData.start_time,
          end_time: formData.end_time,
          recurrence_type: formData.recurrence_type,
          recurrence_days: formData.recurrence_type === 'weekly' ? formData.recurrence_days : [],
          recurrence_date: formData.recurrence_type === 'monthly' ? formData.recurrence_date : null,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          notes: formData.notes,
          is_active: true
        })
        .select()
        .single();

      if (patternError) throw patternError;

      await generateBookingsFromPattern(pattern);

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      console.error('Error creating recurring booking:', err);
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
    } finally {
      setGenerating(false);
    }
  };

  const generateBookingsFromPattern = async (pattern: any) => {
    const bookings = [];
    const startDate = new Date(pattern.start_date);
    const endDate = pattern.end_date ? new Date(pattern.end_date) : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    const space = spaces.find(s => s.id === pattern.space_id);
    if (!space) return;

    const [startHour, startMinute] = pattern.start_time.split(':').map(Number);
    const [endHour, endMinute] = pattern.end_time.split(':').map(Number);
    const totalHours = (endHour + endMinute / 60) - (startHour + startMinute / 60);

    // Determine rate type and calculate amount
    let rateType: 'hourly' | 'half_day' | 'full_day';
    let appliedRate: number;
    let subtotal: number;

    const spaceAny = space as any;

    if (totalHours >= 8) {
      // Full day rate (8+ hours)
      rateType = 'full_day';
      appliedRate = spaceAny.full_day_rate || (spaceAny.hourly_rate * 8) || 200;
      subtotal = appliedRate;
    } else if (totalHours >= 4) {
      // Half day rate (4-7 hours)
      rateType = 'half_day';
      appliedRate = spaceAny.half_day_rate || (spaceAny.hourly_rate * 4) || 100;
      subtotal = appliedRate;
    } else {
      // Hourly rate (< 4 hours)
      rateType = 'hourly';
      appliedRate = spaceAny.hourly_rate || 25;
      subtotal = totalHours * appliedRate;
    }

    const selectedTenant = tenants.find(t => t.id === pattern.tenant_id);
    const discountPercentage = Number(selectedTenant?.meeting_discount_percentage) || 0;
    const discountAmount = (subtotal * discountPercentage) / 100;
    const totalAmount = subtotal - discountAmount;

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      let shouldBook = false;

      if (pattern.recurrence_type === 'daily') {
        shouldBook = true;
      } else if (pattern.recurrence_type === 'weekly') {
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()];
        shouldBook = pattern.recurrence_days.includes(dayName);
      } else if (pattern.recurrence_type === 'monthly') {
        shouldBook = currentDate.getDate() === pattern.recurrence_date;
      }

      if (shouldBook) {
        bookings.push({
          space_id: pattern.space_id,
          tenant_id: pattern.tenant_id,
          booking_date: currentDate.toISOString().split('T')[0],
          start_time: pattern.start_time,
          end_time: pattern.end_time,
          hourly_rate: (space as any).hourly_rate || 25,
          total_hours: totalHours,
          total_amount: totalAmount,
          discount_percentage: discountPercentage,
          discount_amount: discountAmount,
          rate_type: rateType,
          applied_rate: appliedRate,
          status: 'confirmed',
          notes: pattern.notes || '',
          recurring_pattern_id: pattern.id,
          is_exception: false,
          booking_type: 'tenant'
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (bookings.length > 0) {
      const { error } = await supabase
        .from('meeting_room_bookings')
        .insert(bookings);

      if (error) throw error;
    }
  };

  const resetForm = () => {
    setFormData({
      space_id: '',
      tenant_id: preSelectedTenantId || '',
      start_time: '09:00',
      end_time: '10:00',
      recurrence_type: 'weekly',
      recurrence_days: [],
      recurrence_date: 1,
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      notes: ''
    });
    setError('');
  };

  const toggleWeekday = (day: string) => {
    setFormData(prev => ({
      ...prev,
      recurrence_days: prev.recurrence_days.includes(day)
        ? prev.recurrence_days.filter(d => d !== day)
        : [...prev.recurrence_days, day]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-dark-700">
        <div className="flex items-center justify-between p-4 border-b border-dark-700 sticky top-0 bg-dark-800 z-10">
          <div className="flex items-center gap-2">
            <Repeat className="text-blue-400" size={20} />
            <h2 className="text-lg font-semibold text-gray-100">Terugkerende Boeking</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Vergaderruimte
              </label>
              <select
                value={formData.space_id}
                onChange={(e) => setFormData({ ...formData, space_id: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecteer ruimte</option>
                {spaces.map(space => (
                  <option key={space.id} value={space.id}>{space.space_number}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Huurder
              </label>
              <select
                value={formData.tenant_id}
                onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={!!preSelectedTenantId}
              >
                <option value="">Selecteer huurder</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} {tenant.company_name && `(${tenant.company_name})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Starttijd
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Eindtijd
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Herhaling
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, recurrence_type: 'daily' })}
                className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                  formData.recurrence_type === 'daily'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Dagelijks
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, recurrence_type: 'weekly' })}
                className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                  formData.recurrence_type === 'weekly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Wekelijks
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, recurrence_type: 'monthly' })}
                className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                  formData.recurrence_type === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Maandelijks
              </button>
            </div>
          </div>

          {formData.recurrence_type === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Selecteer dagen
              </label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAYS.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekday(day.value)}
                    className={`w-12 h-12 rounded-full font-medium transition-colors ${
                      formData.recurrence_days.includes(day.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {formData.recurrence_type === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Dag van de maand
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.recurrence_date}
                onChange={(e) => setFormData({ ...formData, recurrence_date: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Startdatum
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Einddatum (optioneel)
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Notities (optioneel)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              placeholder="Bijv. Team meeting"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 font-medium transition-colors"
              disabled={generating}
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={generating}
            >
              {generating ? 'Aanmaken...' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
