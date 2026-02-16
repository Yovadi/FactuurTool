import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, X, Check, XCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { createAdminNotification } from '../utils/notificationHelper';

type MeetingRoomBooking = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  booking_type: 'tenant' | 'external';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  invoice_id: string | null;
  tenant_id: string | null;
  external_customer_id: string | null;
  space: {
    space_number: string;
  };
  tenants?: {
    company_name: string;
  };
  external_customers?: {
    company_name: string;
  };
  type: 'meeting_room';
};

type FlexBooking = {
  id: string;
  booking_date: string;
  start_time?: string;
  end_time?: string;
  is_half_day: boolean;
  half_day_period?: 'morning' | 'afternoon';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  invoice_id: string | null;
  external_customer_id: string;
  space: {
    space_number: string;
  };
  external_customers?: {
    company_name: string;
  };
  type: 'flex_workspace';
};

type Booking = MeetingRoomBooking | FlexBooking;

type BookingOverviewProps = {
  customerId: string;
  customerType: 'tenant' | 'external';
  customerName: string;
  onClose: () => void;
};

export function BookingOverview({ customerId, customerType, customerName, onClose }: BookingOverviewProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'invoiced' | 'not_invoiced'>('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadBookings();
  }, [customerId, customerType]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadBookings = async () => {
    setLoading(true);

    const meetingRoomQuery = supabase
      .from('meeting_room_bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        booking_type,
        status,
        invoice_id,
        tenant_id,
        external_customer_id,
        space:office_spaces(space_number),
        tenants(company_name),
        external_customers(company_name)
      `)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (customerType === 'tenant') {
      meetingRoomQuery.eq('tenant_id', customerId).eq('booking_type', 'tenant');
    } else {
      meetingRoomQuery.eq('external_customer_id', customerId).eq('booking_type', 'external');
    }

    const { data: meetingRoomData, error: meetingRoomError } = await meetingRoomQuery;

    if (meetingRoomError) {
      console.error('Error loading meeting room bookings:', meetingRoomError);
    }

    let flexData: any[] = [];
    if (customerType === 'external') {
      const { data, error } = await supabase
        .from('flex_day_bookings')
        .select(`
          id,
          booking_date,
          start_time,
          end_time,
          is_half_day,
          half_day_period,
          status,
          invoice_id,
          external_customer_id,
          space:office_spaces(space_number),
          external_customers(company_name)
        `)
        .eq('external_customer_id', customerId)
        .order('booking_date', { ascending: false });

      if (error) {
        console.error('Error loading flex bookings:', error);
      } else {
        flexData = data || [];
      }
    }

    const allBookings: Booking[] = [
      ...(meetingRoomData || []).map(b => ({ ...b, type: 'meeting_room' as const })),
      ...(flexData || []).map(b => ({ ...b, type: 'flex_workspace' as const }))
    ].sort((a, b) => new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime());

    setBookings(allBookings);
    setLoading(false);
  };

  const handleStatusChange = async (booking: Booking, newStatus: 'confirmed' | 'cancelled') => {
    const tableName = booking.type === 'meeting_room' ? 'meeting_room_bookings' : 'flex_day_bookings';

    const { error } = await supabase
      .from(tableName)
      .update({ status: newStatus })
      .eq('id', booking.id);

    if (error) {
      console.error('Error updating status:', error);
      showNotification('Fout bij het bijwerken van de status.', 'error');
      return;
    }

    if (newStatus === 'cancelled') {
      const customerName = booking.type === 'meeting_room'
        ? (booking.tenant_id ? (booking.tenants?.company_name || 'Onbekende huurder') : (booking.external_customers?.company_name || 'Onbekende klant'))
        : (booking.external_customers?.company_name || 'Onbekende klant');

      const spaceNumber = booking.space?.space_number || 'Onbekende ruimte';
      const bookingDate = new Date(booking.booking_date).toLocaleDateString('nl-NL');
      const bookingDetails = booking.type === 'meeting_room'
        ? `${spaceNumber} op ${bookingDate} ${booking.start_time?.substring(0, 5) || '--:--'}-${booking.end_time?.substring(0, 5) || '--:--'}`
        : booking.start_time && booking.end_time
        ? `${spaceNumber} op ${bookingDate} ${booking.start_time.substring(0, 5)}-${booking.end_time.substring(0, 5)}`
        : `${spaceNumber} op ${bookingDate} ${booking.is_half_day ? (booking.half_day_period === 'morning' ? 'Ochtend' : 'Middag') : 'Hele dag'}`;

      await createAdminNotification(
        'booking_cancelled',
        booking.type,
        booking.id,
        customerName,
        bookingDetails,
        booking.type === 'meeting_room' ? booking.tenant_id || undefined : undefined,
        booking.type === 'meeting_room' ? booking.external_customer_id || undefined : booking.external_customer_id
      );
    }

    setBookings(prev =>
      prev.map(b => (b.id === booking.id ? { ...b, status: newStatus } : b))
    );

    const statusText = newStatus === 'confirmed' ? 'geaccepteerd' : 'geannuleerd';
    showNotification(`Boeking is ${statusText}.`, 'success');
  };

  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true;
    if (filter === 'pending') return booking.status === 'pending';
    if (filter === 'invoiced') return booking.invoice_id !== null;
    if (filter === 'not_invoiced') return booking.invoice_id === null;
    return true;
  });

  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const invoicedBookings = bookings.filter(b => b.invoice_id !== null).length;
  const notInvoicedBookings = bookings.filter(b => b.invoice_id === null).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-orange-900 text-orange-400">IN AFWACHTING</span>;
      case 'confirmed':
        return <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-900 text-blue-400">BEVESTIGD</span>;
      case 'cancelled':
        return <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-red-900 text-red-400">GEANNULEERD</span>;
      case 'completed':
        return <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-900 text-green-400">VOLTOOID</span>;
      default:
        return null;
    }
  };

  const getTimeDisplay = (booking: Booking) => {
    if (booking.type === 'meeting_room') {
      return `${booking.start_time || '--:--'} - ${booking.end_time || '--:--'}`;
    } else {
      if (booking.start_time && booking.end_time) {
        return `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}`;
      } else if (booking.is_half_day) {
        return booking.half_day_period === 'morning' ? 'Ochtend' : 'Middag';
      } else {
        return 'Hele dag';
      }
    }
  };

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
      <div className="bg-dark-900 rounded-lg p-6 max-w-6xl w-full mx-4 my-8 border border-dark-700">
        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            notification.type === 'success' ? 'bg-green-600' :
            notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          } text-white`}>
            {notification.message}
          </div>
        )}

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

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
            <p className="text-gray-400 text-sm mb-1">Totaal Boekingen</p>
            <p className="text-2xl font-bold text-gray-100">{totalBookings}</p>
          </div>
          <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={16} className="text-orange-400" />
              <p className="text-gray-400 text-sm">In Afwachting</p>
            </div>
            <p className="text-2xl font-bold text-orange-400">{pendingBookings}</p>
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
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'pending'
                ? 'bg-orange-600 text-white'
                : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
            }`}
          >
            In Afwachting ({pendingBookings})
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
                    <th className="text-left px-4 py-3 font-semibold">Type</th>
                    <th className="text-left px-4 py-3 font-semibold">Datum</th>
                    <th className="text-left px-4 py-3 font-semibold">Tijd</th>
                    <th className="text-left px-4 py-3 font-semibold">Ruimte</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                    <th className="text-center px-4 py-3 font-semibold">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="border-b border-dark-700 hover:bg-dark-700 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          booking.type === 'meeting_room' ? 'bg-blue-900 text-blue-400' : 'bg-purple-900 text-purple-400'
                        }`}>
                          {booking.type === 'meeting_room' ? 'Vergader' : 'Flex'}
                        </span>
                      </td>
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
                          {getTimeDisplay(booking)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-100 font-medium">
                          {booking.space.space_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(booking.status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {booking.status === 'pending' && !booking.invoice_id && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleStatusChange(booking, 'confirmed')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                              title="Accepteren"
                            >
                              <Check size={14} />
                              Accepteren
                            </button>
                            <button
                              onClick={() => handleStatusChange(booking, 'cancelled')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                              title="Weigeren"
                            >
                              <XCircle size={14} />
                              Weigeren
                            </button>
                          </div>
                        )}
                        {booking.status !== 'pending' && (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
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
