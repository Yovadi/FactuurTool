import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, X } from 'lucide-react';

type Booking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  booking_type: 'internal' | 'external';
  invoiced: boolean;
  space: {
    space_name: string;
    space_type: string;
  };
};

type BookingOverviewProps = {
  customerId: string;
  customerType: 'tenant' | 'external';
  customerName: string;
  onClose: () => void;
};

export function BookingOverview({ customerId, customerType, customerName, onClose }: BookingOverviewProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'invoiced' | 'not_invoiced'>('all');

  useEffect(() => {
    loadBookings();
  }, [customerId, customerType]);

  const loadBookings = async () => {
    setLoading(true);

    const query = supabase
      .from('meeting_room_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        booking_type,
        invoiced,
        space:office_spaces(space_name, space_type)
      `)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (customerType === 'tenant') {
      query.eq('tenant_id', customerId).eq('booking_type', 'internal');
    } else {
      query.eq('external_customer_id', customerId).eq('booking_type', 'external');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading bookings:', error);
    } else {
      setBookings(data || []);
    }

    setLoading(false);
  };

  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true;
    if (filter === 'invoiced') return booking.invoiced;
    if (filter === 'not_invoiced') return !booking.invoiced;
    return true;
  });

  const totalBookings = bookings.length;
  const invoicedBookings = bookings.filter(b => b.invoiced).length;
  const notInvoicedBookings = bookings.filter(b => !b.invoiced).length;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-dark-900 rounded-lg p-8 max-w-4xl w-full mx-4">
          <p className="text-gray-300">Boekingen laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-dark-900 rounded-lg p-6 max-w-4xl w-full mx-4 my-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-100 mb-2">
              Boekingsoverzicht
            </h2>
            <p className="text-gray-400">{customerName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
            <p className="text-gray-400 text-sm mb-1">Totaal Boekingen</p>
            <p className="text-2xl font-bold text-gray-100">{totalBookings}</p>
          </div>
          <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
            <p className="text-gray-400 text-sm mb-1">Gefactureerd</p>
            <p className="text-2xl font-bold text-green-400">{invoicedBookings}</p>
          </div>
          <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
            <p className="text-gray-400 text-sm mb-1">Nog Te Factureren</p>
            <p className="text-2xl font-bold text-amber-400">{notInvoicedBookings}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-gold-500 text-white'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            Alle ({totalBookings})
          </button>
          <button
            onClick={() => setFilter('invoiced')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'invoiced'
                ? 'bg-green-600 text-white'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            Gefactureerd ({invoicedBookings})
          </button>
          <button
            onClick={() => setFilter('not_invoiced')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'not_invoiced'
                ? 'bg-amber-600 text-white'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            Niet Gefactureerd ({notInvoicedBookings})
          </button>
        </div>

        <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
          {filteredBookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                    <th className="text-left px-4 py-3 font-semibold">Datum</th>
                    <th className="text-left px-4 py-3 font-semibold">Tijd</th>
                    <th className="text-left px-4 py-3 font-semibold">Ruimte</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="border-b border-dark-700 hover:bg-dark-700 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Calendar size={16} className="text-gold-500" />
                          {new Date(booking.booking_date).toLocaleDateString('nl-NL', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Clock size={16} className="text-gold-500" />
                          {booking.start_time} - {booking.end_time}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-100 font-medium">
                          {booking.space.space_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            booking.invoiced
                              ? 'bg-green-900 text-green-400'
                              : 'bg-amber-900 text-amber-400'
                          }`}
                        >
                          {booking.invoiced ? 'GEFACTUREERD' : 'NIET GEFACTUREERD'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Calendar size={48} className="text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Geen boekingen gevonden</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-dark-800 text-gray-200 rounded-lg hover:bg-dark-700 transition-colors"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
