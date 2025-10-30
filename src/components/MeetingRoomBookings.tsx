import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, Plus, X, Check, AlertCircle, Trash2, CalendarDays, FileText } from 'lucide-react';
import { BookingCalendar } from './BookingCalendar';

type Tenant = {
  id: string;
  name: string;
  company_name: string;
};

type Space = {
  id: string;
  name: string;
  hourly_rate?: number;
};

type Booking = {
  id: string;
  space_id: string;
  tenant_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  total_hours: number;
  total_amount: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  notes: string;
  invoice_id: string | null;
  tenants?: { name: string; company_name: string };
  office_spaces?: { name: string };
};

export function MeetingRoomBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [meetingRooms, setMeetingRooms] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedView, setSelectedView] = useState<'list' | 'calendar'>('list');
  const [selectedFilter, setSelectedFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const [formData, setFormData] = useState({
    space_id: '',
    tenant_id: '',
    booking_date: '',
    start_time: '09:00',
    end_time: '10:00',
    hourly_rate: 25,
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [selectedFilter]);

  const loadData = async () => {
    setLoading(true);

    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('id, name, company_name')
      .order('name');

    const { data: spacesData } = await supabase
      .from('office_spaces')
      .select('id, name, space_type, hourly_rate')
      .eq('space_type', 'Meeting Room')
      .order('name');

    let bookingsQuery = supabase
      .from('meeting_room_bookings')
      .select(`
        *,
        tenants(name, company_name),
        office_spaces(name)
      `)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    const today = new Date().toISOString().split('T')[0];

    if (selectedFilter === 'upcoming') {
      bookingsQuery = bookingsQuery
        .gte('booking_date', today)
        .neq('status', 'cancelled');
    } else if (selectedFilter === 'past') {
      bookingsQuery = bookingsQuery.lt('booking_date', today);
    }

    const { data: bookingsData } = await bookingsQuery;

    setTenants(tenantsData || []);
    setMeetingRooms(spacesData || []);
    setBookings(bookingsData || []);
    setLoading(false);
  };

  const calculateTotalHours = (startTime: string, endTime: string) => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalHours = calculateTotalHours(formData.start_time, formData.end_time);
    const totalAmount = totalHours * formData.hourly_rate;

    const { error } = await supabase
      .from('meeting_room_bookings')
      .insert({
        space_id: formData.space_id,
        tenant_id: formData.tenant_id,
        booking_date: formData.booking_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        hourly_rate: formData.hourly_rate,
        total_hours: totalHours,
        total_amount: totalAmount,
        status: 'confirmed',
        notes: formData.notes
      });

    if (error) {
      alert('Fout bij het aanmaken van de boeking: ' + error.message);
      return;
    }

    setShowForm(false);
    setFormData({
      space_id: '',
      tenant_id: '',
      booking_date: '',
      start_time: '09:00',
      end_time: '10:00',
      hourly_rate: 25,
      notes: ''
    });
    loadData();
  };

  const handleStatusChange = async (bookingId: string, newStatus: 'confirmed' | 'cancelled' | 'completed') => {
    const { error } = await supabase
      .from('meeting_room_bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (error) {
      alert('Fout bij het updaten van de status: ' + error.message);
      return;
    }

    loadData();
  };

  const handleDelete = async (bookingId: string) => {
    if (!confirm('Weet je zeker dat je deze boeking wilt verwijderen?')) {
      return;
    }

    const { error } = await supabase
      .from('meeting_room_bookings')
      .delete()
      .eq('id', bookingId);

    if (error) {
      alert('Fout bij het verwijderen: ' + error.message);
      return;
    }

    loadData();
  };

  const handleGenerateInvoice = async (booking: Booking) => {
    if (booking.invoice_id) {
      alert('Deze boeking is al gefactureerd');
      return;
    }

    if (!confirm(`Factuur aanmaken voor ${booking.tenants?.name}?\nBedrag: €${booking.total_amount.toFixed(2)}`)) {
      return;
    }

    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('vat_rate')
      .single();

    const vatRate = companySettings?.vat_rate || 0;
    const subtotal = booking.total_amount;
    const vatAmount = subtotal * (vatRate / 100);
    const totalAmount = subtotal + vatAmount;

    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id: booking.tenant_id,
        invoice_date: invoiceDate,
        due_date: dueDateStr,
        status: 'pending',
        subtotal: subtotal,
        vat_amount: vatAmount,
        amount: totalAmount,
        notes: `Vergaderruimte boeking - ${booking.office_spaces?.name}\n${new Date(booking.booking_date).toLocaleDateString('nl-NL')}, ${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}\n${booking.total_hours} uur @ €${booking.hourly_rate}/uur`
      })
      .select()
      .single();

    if (invoiceError || !invoiceData) {
      alert('Fout bij het aanmaken van de factuur: ' + invoiceError?.message);
      return;
    }

    const { error: updateError } = await supabase
      .from('meeting_room_bookings')
      .update({ invoice_id: invoiceData.id })
      .eq('id', booking.id);

    if (updateError) {
      alert('Fout bij het linken van de boeking aan de factuur: ' + updateError.message);
      return;
    }

    alert('Factuur succesvol aangemaakt!');
    loadData();
  };

  const handleSpaceChange = (spaceId: string) => {
    const selectedRoom = meetingRooms.find(r => r.id === spaceId);
    setFormData({
      ...formData,
      space_id: spaceId,
      hourly_rate: selectedRoom?.hourly_rate || 25
    });
  };

  if (loading) {
    return <div className="text-center py-8">Boekingen laden...</div>;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Vergaderruimte Boekingen</h1>
          <p className="text-gray-300">Beheer boekingen voor vergaderruimtes op uurbasis</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-gold-600 text-white px-6 py-3 rounded-lg hover:bg-gold-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Nieuwe Boeking
        </button>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => setSelectedView('list')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              selectedView === 'list'
                ? 'bg-gold-600 text-white'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            <AlertCircle size={18} />
            Lijst
          </button>
          <button
            onClick={() => setSelectedView('calendar')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              selectedView === 'calendar'
                ? 'bg-gold-600 text-white'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            <CalendarDays size={18} />
            Kalender
          </button>
        </div>

        {selectedView === 'list' && (
          <div className="flex gap-4">
            <button
              onClick={() => setSelectedFilter('upcoming')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedFilter === 'upcoming'
                  ? 'bg-gold-600 text-white'
                  : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
              }`}
            >
              Aankomend
            </button>
            <button
              onClick={() => setSelectedFilter('past')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedFilter === 'past'
                  ? 'bg-gold-600 text-white'
                  : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
              }`}
            >
              Afgelopen
            </button>
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedFilter === 'all'
                  ? 'bg-gold-600 text-white'
                  : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
              }`}
            >
              Alle
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-100">Nieuwe Boeking</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Vergaderruimte
                </label>
                <select
                  value={formData.space_id}
                  onChange={(e) => handleSpaceChange(e.target.value)}
                  className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecteer een ruimte</option>
                  {meetingRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} {room.hourly_rate && `- €${room.hourly_rate}/uur`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Huurder
                </label>
                <select
                  value={formData.tenant_id}
                  onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecteer een huurder</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} {tenant.company_name && `(${tenant.company_name})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Datum
                </label>
                <input
                  type="date"
                  value={formData.booking_date}
                  onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Starttijd
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Eindtijd
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Uurtarief (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">
                  Notities
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-dark-600 rounded-lg bg-dark-900 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                />
              </div>

              <div className="bg-dark-700 p-4 rounded-lg">
                <p className="text-sm text-gray-300">
                  <strong>Totale uren:</strong>{' '}
                  {calculateTotalHours(formData.start_time, formData.end_time).toFixed(2)} uur
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  <strong>Totaalbedrag:</strong> €
                  {(calculateTotalHours(formData.start_time, formData.end_time) * formData.hourly_rate).toFixed(2)}
                </p>
              </div>

              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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

      {selectedView === 'calendar' ? (
        <BookingCalendar />
      ) : (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-dark-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Datum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Tijd
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Ruimte
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Huurder
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Uren
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Bedrag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
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
                  <tr key={booking.id} className="hover:bg-dark-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-gray-200">
                        <Calendar size={16} className="text-gray-400" />
                        {new Date(booking.booking_date).toLocaleDateString('nl-NL')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-gray-200">
                        <Clock size={16} className="text-gray-400" />
                        {booking.start_time.substring(0, 5)} - {booking.end_time.substring(0, 5)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-200">
                      {booking.office_spaces?.name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-200">{booking.tenants?.name}</div>
                      {booking.tenants?.company_name && (
                        <div className="text-xs text-gray-400">{booking.tenants.company_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-200">
                      {booking.total_hours.toFixed(2)} uur
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-200">
                      €{booking.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          booking.status === 'confirmed'
                            ? 'bg-blue-900/50 text-blue-300'
                            : booking.status === 'completed'
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-red-900/50 text-red-300'
                        }`}
                      >
                        {booking.status === 'confirmed'
                          ? 'Bevestigd'
                          : booking.status === 'completed'
                          ? 'Voltooid'
                          : 'Geannuleerd'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {!booking.invoice_id && booking.status === 'completed' && (
                          <button
                            onClick={() => handleGenerateInvoice(booking)}
                            className="text-gold-400 hover:text-gold-300"
                            title="Factuur aanmaken"
                          >
                            <FileText size={18} />
                          </button>
                        )}
                        {booking.invoice_id && (
                          <span className="text-xs text-green-400" title="Gefactureerd">
                            <FileText size={18} />
                          </span>
                        )}
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'completed')}
                            className="text-green-400 hover:text-green-300"
                            title="Markeer als voltooid"
                          >
                            <Check size={18} />
                          </button>
                        )}
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'cancelled')}
                            className="text-red-400 hover:text-red-300"
                            title="Annuleer boeking"
                          >
                            <AlertCircle size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(booking.id)}
                          className="text-gray-400 hover:text-red-400"
                          title="Verwijder boeking"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
