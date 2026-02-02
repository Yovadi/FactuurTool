import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Plus, X, Check, AlertCircle, Trash2, CalendarDays, CheckCircle, XCircle, Info, Filter, Building2, Users } from 'lucide-react';
import { InlineDatePicker } from './InlineDatePicker';

type NotificationType = 'success' | 'error' | 'info';

type Notification = {
  id: number;
  message: string;
  type: NotificationType;
};

type Tenant = {
  id: string;
  name: string;
  company_name: string;
};

type ExternalCustomer = {
  id: string;
  company_name: string;
  contact_name: string;
  email?: string;
  phone?: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
};

type FlexSpace = {
  id: string;
  space_number: string;
  flex_capacity: number | null;
};

type FlexBooking = {
  id: string;
  space_id: string;
  lease_id: string | null;
  external_customer_id: string | null;
  booking_date: string;
  is_half_day: boolean;
  half_day_period?: 'morning' | 'afternoon';
  invoice_id: string | null;
  created_at: string;
  office_spaces?: { space_number: string };
  leases?: {
    tenants: { name: string; company_name: string };
  };
  external_customers?: ExternalCustomer;
};

type Lease = {
  id: string;
  tenant_id: string;
  lease_type: string;
  status: string;
  tenants: Tenant;
};

export function FlexWorkspaceBookings() {
  const [bookings, setBookings] = useState<FlexBooking[]>([]);
  const [allBookings, setAllBookings] = useState<FlexBooking[]>([]);
  const [flexSpaces, setFlexSpaces] = useState<FlexSpace[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<ExternalCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedView, setSelectedView] = useState<'list' | 'calendar'>('list');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'internal' | 'external' | 'upcoming' | 'invoiced'>('all');
  const [customerType, setCustomerType] = useState<'lease' | 'external'>('lease');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationId, setNotificationId] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    space_id: '',
    lease_id: '',
    external_customer_id: '',
    booking_date: new Date().toISOString().split('T')[0],
    is_half_day: false,
    half_day_period: 'morning' as 'morning' | 'afternoon'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [selectedFilter, allBookings]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bookingsRes, spacesRes, leasesRes, customersRes] = await Promise.all([
        supabase
          .from('flex_day_bookings')
          .select(`
            *,
            office_spaces(space_number),
            leases(
              tenants(name, company_name)
            ),
            external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country)
          `)
          .order('booking_date', { ascending: false }),
        supabase
          .from('office_spaces')
          .select('id, space_number, flex_capacity')
          .eq('is_flex_space', true)
          .eq('is_available', true)
          .order('space_number'),
        supabase
          .from('leases')
          .select('id, tenant_id, lease_type, status, tenants(id, name, company_name)')
          .eq('lease_type', 'flex')
          .eq('status', 'active')
          .order('tenants(company_name)'),
        supabase
          .from('external_customers')
          .select('*')
          .order('company_name')
      ]);

      if (bookingsRes.data) {
        setAllBookings(bookingsRes.data);
        setBookings(bookingsRes.data);
      }
      if (spacesRes.data) setFlexSpaces(spacesRes.data);
      if (leasesRes.data) setLeases(leasesRes.data as Lease[]);
      if (customersRes.data) setExternalCustomers(customersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Fout bij laden van gegevens', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allBookings];

    switch (selectedFilter) {
      case 'internal':
        filtered = filtered.filter(b => b.lease_id !== null);
        break;
      case 'external':
        filtered = filtered.filter(b => b.external_customer_id !== null);
        break;
      case 'upcoming':
        const today = new Date().toISOString().split('T')[0];
        filtered = filtered.filter(b => b.booking_date >= today);
        break;
      case 'invoiced':
        filtered = filtered.filter(b => b.invoice_id !== null);
        break;
    }

    setBookings(filtered);
  };

  const showNotification = (message: string, type: NotificationType) => {
    const id = notificationId + 1;
    setNotificationId(id);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.space_id) {
      showNotification('Selecteer een flexruimte', 'error');
      return;
    }

    if (customerType === 'lease' && !formData.lease_id) {
      showNotification('Selecteer een huurder', 'error');
      return;
    }

    if (customerType === 'external' && !formData.external_customer_id) {
      showNotification('Selecteer een externe klant', 'error');
      return;
    }

    try {
      const bookingData: any = {
        space_id: formData.space_id,
        booking_date: formData.booking_date,
        is_half_day: formData.is_half_day,
        half_day_period: formData.is_half_day ? formData.half_day_period : null
      };

      if (customerType === 'lease') {
        bookingData.lease_id = formData.lease_id;
      } else {
        bookingData.external_customer_id = formData.external_customer_id;
      }

      const { data, error } = await supabase
        .from('flex_day_bookings')
        .insert([bookingData])
        .select(`
          *,
          office_spaces(space_number),
          leases(
            tenants(name, company_name)
          ),
          external_customers(id, company_name, contact_name, email, phone, street, postal_code, city, country)
        `)
        .single();

      if (error) throw error;

      if (data) {
        setAllBookings(prev => [data, ...prev]);
        showNotification('Flexplekboeking succesvol aangemaakt', 'success');
        setShowForm(false);
        resetForm();
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      const message = error.message?.includes('unique_flex_booking')
        ? 'Deze datum is al geboekt voor deze klant'
        : error.message?.includes('exceed')
        ? 'Maandlimiet bereikt voor deze klant'
        : 'Fout bij aanmaken boeking';
      showNotification(message, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('flex_day_bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAllBookings(prev => prev.filter(b => b.id !== id));
      showNotification('Boeking verwijderd', 'success');
    } catch (error) {
      console.error('Error deleting booking:', error);
      showNotification('Fout bij verwijderen boeking', 'error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      space_id: '',
      lease_id: '',
      external_customer_id: '',
      booking_date: new Date().toISOString().split('T')[0],
      is_half_day: false,
      half_day_period: 'morning'
    });
    setCustomerType('lease');
  };

  const getCustomerName = (booking: FlexBooking) => {
    if (booking.lease_id && booking.leases?.tenants) {
      return booking.leases.tenants.company_name || booking.leases.tenants.name;
    }
    if (booking.external_customer_id && booking.external_customers) {
      return booking.external_customers.company_name;
    }
    return 'Onbekend';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('nl-NL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border backdrop-blur-sm animate-slide-in ${
              notification.type === 'success'
                ? 'bg-green-900/90 border-green-700 text-green-100'
                : notification.type === 'error'
                ? 'bg-red-900/90 border-red-700 text-red-100'
                : 'bg-blue-900/90 border-blue-700 text-blue-100'
            }`}
          >
            {notification.type === 'success' && <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />}
            {notification.type === 'error' && <XCircle size={20} className="flex-shrink-0 mt-0.5" />}
            {notification.type === 'info' && <Info size={20} className="flex-shrink-0 mt-0.5" />}
            <p className="text-sm font-medium flex-1">{notification.message}</p>
            <button
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-100">Flexplek Boekingen</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors font-medium"
          >
            <Plus size={20} />
            Nieuwe Boeking
          </button>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedView('list')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                selectedView === 'list'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <AlertCircle size={18} />
              Lijst
            </button>
            <button
              onClick={() => setSelectedView('calendar')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                selectedView === 'calendar'
                  ? 'bg-gold-500 text-white'
                  : 'text-gray-300 hover:bg-dark-800'
              }`}
            >
              <CalendarDays size={18} />
              Kalender
            </button>
          </div>
        </div>

        {selectedView === 'list' && (
          <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={18} className="text-gray-400" />
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'all', label: 'Alle' },
                  { value: 'internal', label: 'Intern' },
                  { value: 'external', label: 'Extern' },
                  { value: 'upcoming', label: 'Komend' },
                  { value: 'invoiced', label: 'Gefactureerd' }
                ].map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => setSelectedFilter(filter.value as any)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedFilter === filter.value
                        ? 'bg-gold-500 text-white'
                        : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-6 max-w-2xl w-full mx-4 my-8 border border-dark-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-100">Nieuwe Flexplek Boeking</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-dark-800 rounded-lg p-4 space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomerType('lease')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                      customerType === 'lease'
                        ? 'bg-gold-500 text-white'
                        : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                    }`}
                  >
                    <Users size={18} />
                    Interne Huurder
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerType('external')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                      customerType === 'external'
                        ? 'bg-gold-500 text-white'
                        : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                    }`}
                  >
                    <Building2 size={18} />
                    Externe Klant
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Flexruimte *
                </label>
                <select
                  value={formData.space_id}
                  onChange={(e) => setFormData({ ...formData, space_id: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                  required
                >
                  <option value="">Selecteer ruimte</option>
                  {flexSpaces.map(space => (
                    <option key={space.id} value={space.id}>
                      {space.space_number} {space.flex_capacity && `(max ${space.flex_capacity} personen)`}
                    </option>
                  ))}
                </select>
              </div>

              {customerType === 'lease' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Huurder *
                  </label>
                  <select
                    value={formData.lease_id}
                    onChange={(e) => setFormData({ ...formData, lease_id: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                    required
                  >
                    <option value="">Selecteer huurder</option>
                    {leases.map(lease => (
                      <option key={lease.id} value={lease.id}>
                        {lease.tenants.company_name || lease.tenants.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Externe Klant *
                  </label>
                  <select
                    value={formData.external_customer_id}
                    onChange={(e) => setFormData({ ...formData, external_customer_id: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                    required
                  >
                    <option value="">Selecteer klant</option>
                    {externalCustomers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Datum *
                </label>
                <input
                  type="date"
                  value={formData.booking_date}
                  onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 focus:outline-none focus:border-gold-500"
                  required
                />
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_half_day}
                    onChange={(e) => setFormData({ ...formData, is_half_day: e.target.checked })}
                    className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-gold-500 focus:ring-gold-500 focus:ring-offset-dark-900"
                  />
                  <span className="text-sm font-medium text-gray-300">Halve dag</span>
                </label>

                {formData.is_half_day && (
                  <div className="flex gap-2 ml-6">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, half_day_period: 'morning' })}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        formData.half_day_period === 'morning'
                          ? 'bg-gold-500 text-white'
                          : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                      }`}
                    >
                      Ochtend
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, half_day_period: 'afternoon' })}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        formData.half_day_period === 'afternoon'
                          ? 'bg-gold-500 text-white'
                          : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                      }`}
                    >
                      Middag
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors font-medium"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors font-medium"
                >
                  Boeking Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedView === 'list' ? (
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-800 border-b border-dark-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Ruimte
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Klant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Periode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      Geen boekingen gevonden
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-dark-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{formatDate(booking.booking_date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-100">
                          {booking.office_spaces?.space_number || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-100">
                          {getCustomerName(booking)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          booking.lease_id
                            ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                            : 'bg-orange-900/50 text-orange-300 border border-orange-700'
                        }`}>
                          {booking.lease_id ? (
                            <>
                              <Users size={12} />
                              Intern
                            </>
                          ) : (
                            <>
                              <Building2 size={12} />
                              Extern
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">
                          {booking.is_half_day
                            ? `Halve dag (${booking.half_day_period === 'morning' ? 'Ochtend' : 'Middag'})`
                            : 'Hele dag'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {booking.invoice_id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-700">
                            <CheckCircle size={12} />
                            Gefactureerd
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
                            <Calendar size={12} />
                            Gepland
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {!booking.invoice_id && (
                          <>
                            {deleteConfirmId === booking.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleDelete(booking.id)}
                                  className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                                  title="Bevestig verwijderen"
                                >
                                  <Check size={18} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="p-1.5 text-gray-400 hover:text-gray-300 transition-colors"
                                  title="Annuleer"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(booking.id)}
                                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                                title="Verwijder boeking"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-6">
          <div className="text-center text-gray-400 py-12">
            <CalendarDays size={48} className="mx-auto mb-4 opacity-50" />
            <p>Kalenderweergave komt binnenkort beschikbaar</p>
          </div>
        </div>
      )}
    </div>
  );
}
