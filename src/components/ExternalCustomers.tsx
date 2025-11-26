import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Mail, Phone, MapPin, Key, AlertCircle } from 'lucide-react';

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
  booking_pin_code?: string;
  created_at?: string;
  updated_at?: string;
};

export function ExternalCustomers() {
  const [customers, setCustomers] = useState<ExternalCustomer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ExternalCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteError, setShowDeleteError] = useState<{
    message: string;
    details: string[];
  } | null>(null);

  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    street: '',
    postal_code: '',
    city: '',
    country: 'Nederland',
    booking_pin_code: ''
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('external_customers')
      .select('*')
      .order('company_name');

    if (error) {
      console.error('Error loading customers:', error);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCustomer) {
      const { data, error } = await supabase
        .from('external_customers')
        .update(formData)
        .eq('id', editingCustomer.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating customer:', error);
        return;
      }

      if (data) {
        setCustomers(customers.map(c => c.id === editingCustomer.id ? data : c));
      }
    } else {
      const { data, error } = await supabase
        .from('external_customers')
        .insert([formData])
        .select()
        .single();

      if (error) {
        console.error('Error creating customer:', error);
        return;
      }

      if (data) {
        setCustomers([...customers, data].sort((a, b) => a.company_name.localeCompare(b.company_name)));
      }
    }

    setShowForm(false);
    setEditingCustomer(null);
    setFormData({
      company_name: '',
      contact_name: '',
      email: '',
      phone: '',
      street: '',
      postal_code: '',
      city: '',
      country: 'Nederland',
      booking_pin_code: ''
    });
  };

  const handleEdit = (customer: ExternalCustomer) => {
    setEditingCustomer(customer);
    setFormData({
      company_name: customer.company_name,
      contact_name: customer.contact_name,
      email: customer.email || '',
      phone: customer.phone || '',
      street: customer.street,
      postal_code: customer.postal_code,
      city: customer.city,
      country: customer.country,
      booking_pin_code: customer.booking_pin_code || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze externe klant wilt verwijderen?')) {
      return;
    }

    console.log('Starting delete check for customer:', id);
    const details: string[] = [];

    // Check for existing invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id')
      .eq('external_customer_id', id);

    console.log('Invoices check:', { invoices, invoicesError });

    if (invoices && invoices.length > 0) {
      details.push(`${invoices.length} factuur${invoices.length > 1 ? 'uren' : ''}`);
    }

    // Check for existing credit notes
    const { data: creditNotes, error: creditNotesError } = await supabase
      .from('credit_notes')
      .select('id')
      .eq('external_customer_id', id);

    console.log('Credit notes check:', { creditNotes, creditNotesError });

    if (creditNotes && creditNotes.length > 0) {
      details.push(`${creditNotes.length} creditnota${creditNotes.length > 1 ? "'s" : ''}`);
    }

    // Check for existing bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('meeting_room_bookings')
      .select('id')
      .eq('external_customer_id', id);

    console.log('Bookings check:', { bookings, bookingsError });

    if (bookings && bookings.length > 0) {
      details.push(`${bookings.length} boeking${bookings.length > 1 ? 'en' : ''}`);
    }

    console.log('Details collected:', details);

    if (details.length > 0) {
      console.log('Setting delete error modal');
      setShowDeleteError({
        message: 'Deze externe klant kan niet worden verwijderd',
        details
      });
      return;
    }

    const { error } = await supabase
      .from('external_customers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      setShowDeleteError({
        message: 'Fout bij verwijderen',
        details: [error.message]
      });
    } else {
      console.log('Customer deleted successfully');
      setCustomers(customers.filter(c => c.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-100">Externe Huurders</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingCustomer(null);
            setFormData({
              company_name: '',
              contact_name: '',
              email: '',
              phone: '',
              street: '',
              postal_code: '',
              city: '',
              country: 'Nederland',
              booking_pin_code: ''
            });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 transition-colors"
        >
          <Plus size={20} />
          Nieuwe Klant
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {editingCustomer ? 'Klant Bewerken' : 'Nieuwe Klant'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Bedrijfsnaam *
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Contactpersoon *
                </label>
                <input
                  type="text"
                  required
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Telefoon
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Straat + Huisnummer *
              </label>
              <input
                type="text"
                required
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Postcode *
                </label>
                <input
                  type="text"
                  required
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Plaats *
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Land *
                </label>
                <input
                  type="text"
                  required
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Booking Pincode (optioneel)
              </label>
              <input
                type="text"
                value={formData.booking_pin_code}
                onChange={(e) => setFormData({ ...formData, booking_pin_code: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                placeholder="4-cijferige pincode voor zelfstandig boeken"
                maxLength={4}
              />
              <p className="text-xs text-gray-400 mt-1">
                Geef deze pincode aan de klant zodat ze zelfstandig vergaderruimtes kunnen boeken
              </p>
            </div>

            <div className="flex gap-4 justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingCustomer(null);
                }}
                className="px-6 py-2 border border-dark-600 rounded-lg text-gray-300 hover:bg-dark-700 transition-colors"
              >
                Annuleren
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 transition-colors"
              >
                {editingCustomer ? 'Bijwerken' : 'Toevoegen'}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-dark-900 rounded-lg p-8 text-center">
          <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Laden...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-dark-900 rounded-lg p-8 text-center">
          <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Geen externe klanten gevonden.</p>
          <p className="text-sm text-gray-500 mt-2">Klik op "Nieuwe Klant" om te beginnen.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="bg-dark-800 rounded-lg p-4 hover:bg-dark-750 transition-colors border border-dark-700"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gold-600 bg-opacity-20 rounded-lg flex items-center justify-center">
                      <span className="text-gold-500 font-bold text-lg">
                        {customer.company_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 grid grid-cols-3 gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-100 truncate">{customer.company_name}</h3>
                      <p className="text-gray-400 text-sm truncate">{customer.contact_name}</p>
                    </div>

                    <div className="space-y-1">
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-300 truncate">
                          <Mail size={14} className="text-gold-500 flex-shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Phone size={14} className="text-gold-500 flex-shrink-0" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-start gap-2 text-sm text-gray-300 flex-1">
                        <MapPin size={14} className="text-gold-500 flex-shrink-0 mt-0.5" />
                        <div className="leading-tight">
                          <div className="truncate">{customer.street}</div>
                          <div>{customer.postal_code} {customer.city}</div>
                        </div>
                      </div>
                      {customer.booking_pin_code && (
                        <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900 bg-opacity-20 px-2 py-1 rounded flex-shrink-0">
                          <Key size={12} />
                          <span>{customer.booking_pin_code}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(customer)}
                    className="p-2 text-blue-400 hover:bg-dark-700 rounded-lg transition-colors"
                    title="Bewerken"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="p-2 text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                    title="Verwijderen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Error Modal */}
      {showDeleteError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg shadow-xl max-w-md w-full border border-red-900">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-900 bg-opacity-20 rounded-full flex items-center justify-center">
                    <AlertCircle size={24} className="text-red-500" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">
                    {showDeleteError.message}
                  </h3>
                  <p className="text-gray-300 mb-3">
                    Deze externe klant heeft nog actieve koppelingen:
                  </p>
                  <ul className="list-disc list-inside space-y-1 mb-4">
                    {showDeleteError.details.map((detail, index) => (
                      <li key={index} className="text-gray-400">{detail}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-gray-400">
                    Verwijder eerst deze koppelingen voordat je de externe klant verwijdert.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-dark-900 rounded-b-lg flex justify-end">
              <button
                onClick={() => setShowDeleteError(null)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
