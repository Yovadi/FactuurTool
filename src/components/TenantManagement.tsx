import { useState, useEffect } from 'react';
import { supabase, type Tenant, type CompanySettings } from '../lib/supabase';
import { Plus, Edit2, Trash2, Mail, Phone, MapPin, Key, Users, Building2, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { BookingOverview } from './BookingOverview';

type TenantWithLeases = Tenant & {
  leases?: Array<{
    id: string;
    status: string;
    lease_type?: string;
  }>;
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
  booking_pin_code?: string;
  lease_discount_percentage?: number;
  meeting_discount_percentage?: number;
  created_at?: string;
  updated_at?: string;
};

export function TenantManagement() {
  const [activeTab, setActiveTab] = useState<'fulltime' | 'external' | 'inactive'>('fulltime');
  const [tenants, setTenants] = useState<TenantWithLeases[]>([]);
  const [externalCustomers, setExternalCustomers] = useState<ExternalCustomer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<ExternalCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [showBookingOverview, setShowBookingOverview] = useState<{
    customerId: string;
    customerType: 'tenant' | 'external';
    customerName: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    street: '',
    postal_code: '',
    city: '',
    country: 'Nederland',
    booking_pin_code: '',
    lease_discount_percentage: 0,
    meeting_discount_percentage: 10
  });

  useEffect(() => {
    loadTenants();
    loadExternalCustomers();
    loadCompanySettings();
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tenants')
      .select(`
        *,
        leases(
          id,
          status,
          lease_type
        )
      `)
      .order('name');

    if (error) {
      console.error('Error loading tenants:', error);
    } else {
      setTenants(data || []);
    }
    setLoading(false);
  };

  const loadExternalCustomers = async () => {
    const { data, error } = await supabase
      .from('external_customers')
      .select('*')
      .order('company_name');

    if (error) {
      console.error('Error loading external customers:', error);
    } else {
      setExternalCustomers(data || []);
    }
  };

  const loadCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setCompanySettings(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'fulltime' || activeTab === 'inactive') {
      if (editingTenant) {
        const { data, error } = await supabase
          .from('tenants')
          .update(formData)
          .eq('id', editingTenant.id)
          .select(`
            *,
            leases(
              id,
              status,
              lease_type
            )
          `)
          .single();

        if (error) {
          console.error('Error updating tenant:', error);
          return;
        }

        if (data) {
          setTenants(tenants.map(t => t.id === editingTenant.id ? data : t));
        }
      } else {
        const { data, error } = await supabase
          .from('tenants')
          .insert([formData])
          .select(`
            *,
            leases(
              id,
              status,
              lease_type
            )
          `)
          .single();

        if (error) {
          console.error('Error creating tenant:', error);
          return;
        }

        if (data) {
          setTenants([...tenants, data].sort((a, b) => a.name.localeCompare(b.name)));
        }

        if (companySettings?.root_folder_path && window.electronAPI?.createTenantFolder) {
          const result = await window.electronAPI.createTenantFolder(
            companySettings.root_folder_path,
            formData.company_name
          );

          if (!result.success) {
            console.error('Error creating tenant folder:', result.error);
          }
        }
      }
    } else {
      const customerData = {
        company_name: formData.company_name,
        contact_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        street: formData.street,
        postal_code: formData.postal_code,
        city: formData.city,
        country: formData.country,
        booking_pin_code: formData.booking_pin_code,
        lease_discount_percentage: formData.lease_discount_percentage,
        meeting_discount_percentage: formData.meeting_discount_percentage
      };

      if (editingCustomer) {
        const { data, error } = await supabase
          .from('external_customers')
          .update(customerData)
          .eq('id', editingCustomer.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating customer:', error);
          return;
        }

        if (data) {
          setExternalCustomers(externalCustomers.map(c => c.id === editingCustomer.id ? data : c));
        }
      } else {
        const { data, error } = await supabase
          .from('external_customers')
          .insert([customerData])
          .select()
          .single();

        if (error) {
          console.error('Error creating customer:', error);
          return;
        }

        if (data) {
          setExternalCustomers([...externalCustomers, data].sort((a, b) => a.company_name.localeCompare(b.company_name)));
        }

        if (companySettings?.root_folder_path && window.electronAPI?.createTenantFolder) {
          const result = await window.electronAPI.createTenantFolder(
            companySettings.root_folder_path,
            customerData.company_name
          );

          if (!result.success) {
            console.error('Error creating external customer folder:', result.error);
          }
        }
      }
    }

    resetForm();
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditingCustomer(null);
    setFormData({
      company_name: tenant.company_name,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone || '',
      street: tenant.street || '',
      postal_code: tenant.postal_code || '',
      city: tenant.city || '',
      country: tenant.country || 'Nederland',
      booking_pin_code: tenant.booking_pin_code || '',
      lease_discount_percentage: tenant.lease_discount_percentage || 0,
      meeting_discount_percentage: tenant.meeting_discount_percentage || 10
    });
    setShowForm(true);
  };

  const handleEditCustomer = (customer: ExternalCustomer) => {
    setEditingCustomer(customer);
    setEditingTenant(null);
    setFormData({
      company_name: customer.company_name,
      name: customer.contact_name,
      email: customer.email || '',
      phone: customer.phone || '',
      street: customer.street,
      postal_code: customer.postal_code,
      city: customer.city,
      country: customer.country,
      booking_pin_code: customer.booking_pin_code || '',
      lease_discount_percentage: customer.lease_discount_percentage || 0,
      meeting_discount_percentage: customer.meeting_discount_percentage || 0
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (activeTab === 'fulltime' || activeTab === 'inactive') {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting tenant:', error);
        return;
      }

      setTenants(tenants.filter(t => t.id !== id));
    } else {
      const { error } = await supabase
        .from('external_customers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting customer:', error);
        return;
      }

      setExternalCustomers(externalCustomers.filter(c => c.id !== id));
    }
  };

  const resetForm = () => {
    setFormData({ company_name: '', name: '', email: '', phone: '', street: '', postal_code: '', city: '', country: 'Nederland', booking_pin_code: '', lease_discount_percentage: 0, meeting_discount_percentage: 10 });
    setEditingTenant(null);
    setEditingCustomer(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="text-center py-8">Huurders laden...</div>;
  }

  return (
    <div className="h-full bg-dark-950 overflow-y-auto p-6">
      <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('fulltime')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'fulltime'
                ? 'bg-gold-500 text-white'
                : 'text-gray-300 hover:bg-dark-800'
            }`}
          >
            <Building2 size={18} />
            Huurders
          </button>
          <button
            onClick={() => setActiveTab('external')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'external'
                ? 'bg-gold-500 text-white'
                : 'text-gray-300 hover:bg-dark-800'
            }`}
          >
            <Users size={18} />
            Externe Huurders
          </button>
          <button
            onClick={() => setActiveTab('inactive')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'inactive'
                ? 'bg-gold-500 text-white'
                : 'text-gray-300 hover:bg-dark-800'
            }`}
          >
            <Building2 size={18} />
            Afgelopen Huurders
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-dark-700">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {activeTab === 'external'
                ? (editingCustomer ? 'Externe Huurder Bewerken' : 'Nieuwe Externe Huurder')
                : (editingTenant ? 'Huurder Bewerken' : 'Nieuwe Huurder')
              }
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
                    Contactpersoon
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
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
                  Geef deze pincode aan de huurder zodat ze zelfstandig vergaderruimtes kunnen boeken
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Korting op verhuur (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={formData.lease_discount_percentage}
                    onChange={(e) => setFormData({ ...formData, lease_discount_percentage: Math.min(100, Math.max(0, Number(e.target.value))) })}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Korting op reguliere ruimteverhuur
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Korting op vergaderruimtes (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={formData.meeting_discount_percentage}
                    onChange={(e) => setFormData({ ...formData, meeting_discount_percentage: Math.min(100, Math.max(0, Number(e.target.value))) })}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100"
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Korting op vergaderruimte boekingen
                  </p>
                </div>
              </div>
              <div className="flex gap-4 justify-end pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-dark-700 text-gray-200 rounded-lg hover:bg-dark-600 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 transition-colors"
                >
                  {(editingTenant || editingCustomer) ? 'Bijwerken' : 'Toevoegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'fulltime' ? (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-dark-800 border-b border-amber-500">
            <h2 className="text-lg font-bold text-gray-100">
              Huurders
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
            >
              <Plus size={20} />
              Huurder Toevoegen
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                  <th className="text-left px-4 py-3 font-semibold w-[18%]">Bedrijf</th>
                  <th className="text-left px-4 py-3 font-semibold w-[14%]">Contactpersoon</th>
                  <th className="text-left px-4 py-3 font-semibold w-[16%]">Email</th>
                  <th className="text-left px-4 py-3 font-semibold w-[11%]">Telefoon</th>
                  <th className="text-left px-4 py-3 font-semibold w-[16%]">Adres</th>
                  <th className="text-center px-4 py-3 font-semibold w-[7%]">PIN</th>
                  <th className="text-right px-4 py-3 font-semibold w-[18%]">Acties</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gold-600 bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-gold-500 font-bold text-sm">
                              {tenant.company_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-gray-100 font-medium">{tenant.company_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{tenant.name || '-'}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        <div className="flex items-center gap-1">
                          <Mail size={14} className="text-gold-500 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{tenant.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {tenant.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone size={14} className="text-gold-500 flex-shrink-0" />
                            <span>{tenant.phone}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {tenant.street && tenant.city ? (
                          <div className="flex items-start gap-1">
                            <MapPin size={14} className="text-gold-500 flex-shrink-0 mt-0.5" />
                            <div className="leading-tight text-xs">
                              <div>{tenant.street}</div>
                              <div className="text-gray-400">{tenant.postal_code} {tenant.city}</div>
                            </div>
                          </div>
                        ) : tenant.billing_address ? (
                          <div className="flex items-center gap-1">
                            <MapPin size={14} className="text-gold-500 flex-shrink-0" />
                            <span className="text-xs">{tenant.billing_address}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tenant.booking_pin_code ? (
                          <div className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-900 bg-opacity-20 px-2 py-1 rounded border border-green-700">
                            <Key size={12} />
                            <span>{tenant.booking_pin_code}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => handleEdit(tenant)}
                            className="text-blue-400 hover:text-blue-300 transition-colors p-1.5 rounded hover:bg-dark-700"
                            title="Bewerken"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(tenant.id)}
                            className="text-red-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-dark-700"
                            title="Verwijderen"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'external' ? (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-dark-800 border-b border-amber-500">
            <h2 className="text-lg font-bold text-gray-100">
              Externe Huurders
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
            >
              <Plus size={20} />
              Externe Huurder Toevoegen
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                  <th className="text-left px-4 py-3 font-semibold w-[18%]">Bedrijf</th>
                  <th className="text-left px-4 py-3 font-semibold w-[14%]">Contactpersoon</th>
                  <th className="text-left px-4 py-3 font-semibold w-[16%]">Email</th>
                  <th className="text-left px-4 py-3 font-semibold w-[11%]">Telefoon</th>
                  <th className="text-left px-4 py-3 font-semibold w-[16%]">Adres</th>
                  <th className="text-center px-4 py-3 font-semibold w-[7%]">PIN</th>
                  <th className="text-right px-4 py-3 font-semibold w-[18%]">Acties</th>
                </tr>
              </thead>
              <tbody>
                {externalCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gold-600 bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-gold-500 font-bold text-sm">
                              {customer.company_name.charAt(0)}
                            </span>
                          </div>
                          <span className="text-gray-100 font-medium truncate">
                            {customer.company_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-300 truncate block">{customer.contact_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        {customer.email ? (
                          <a
                            href={`mailto:${customer.email}`}
                            className="text-gold-500 hover:text-gold-400 flex items-center gap-2 truncate"
                          >
                            <Mail size={16} />
                            <span className="truncate">{customer.email}</span>
                          </a>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {customer.phone ? (
                          <a
                            href={`tel:${customer.phone}`}
                            className="text-gold-500 hover:text-gold-400 flex items-center gap-2 truncate"
                          >
                            <Phone size={16} />
                            <span className="truncate">{customer.phone}</span>
                          </a>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {customer.street ? (
                          <div className="flex items-start gap-2">
                            <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-300 text-sm truncate">
                              {customer.street}, {customer.postal_code} {customer.city}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {customer.booking_pin_code ? (
                          <div className="flex items-center justify-center gap-1">
                            <Key size={16} className="text-gold-500" />
                            <span className="text-gray-300 font-mono text-sm">{customer.booking_pin_code}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setShowBookingOverview({
                              customerId: customer.id,
                              customerType: 'external',
                              customerName: customer.company_name
                            })}
                            className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-dark-700 rounded transition-colors"
                            title="Bekijk Boekingen"
                          >
                            <Calendar size={18} />
                          </button>
                          <button
                            onClick={() => handleEditCustomer(customer)}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-dark-700 rounded transition-colors"
                            title="Bewerken"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="p-1.5 text-red-500 hover:text-red-400 hover:bg-dark-700 rounded transition-colors"
                            title="Verwijderen"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'inactive' ? (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-dark-800 border-b border-amber-500">
            <h2 className="text-lg font-bold text-gray-100">
              Afgelopen Huurders
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                  <th className="text-left px-4 py-3 font-semibold w-[20%]">Bedrijf</th>
                  <th className="text-left px-4 py-3 font-semibold w-[15%]">Contactpersoon</th>
                  <th className="text-left px-4 py-3 font-semibold w-[18%]">Email</th>
                  <th className="text-left px-4 py-3 font-semibold w-[12%]">Telefoon</th>
                  <th className="text-left px-4 py-3 font-semibold w-[18%]">Adres</th>
                  <th className="text-center px-4 py-3 font-semibold w-[8%]">PIN</th>
                  <th className="text-right px-4 py-3 font-semibold w-[9%]">Acties</th>
                </tr>
              </thead>
              <tbody>
                {tenants
                  .filter(tenant =>
                    tenant.leases &&
                    tenant.leases.length > 0 &&
                    tenant.leases.every(lease => lease.status !== 'active')
                  )
                  .map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-600 bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-400 font-bold text-sm">
                              {tenant.company_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-gray-300 font-medium">{tenant.company_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{tenant.name || '-'}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        <div className="flex items-center gap-1">
                          <Mail size={14} className="text-gray-500 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{tenant.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {tenant.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone size={14} className="text-gray-500 flex-shrink-0" />
                            <span>{tenant.phone}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {tenant.street && tenant.city ? (
                          <div className="flex items-start gap-1">
                            <MapPin size={14} className="text-gray-500 flex-shrink-0 mt-0.5" />
                            <div className="leading-tight text-xs">
                              <div>{tenant.street}</div>
                              <div className="text-gray-500">{tenant.postal_code} {tenant.city}</div>
                            </div>
                          </div>
                        ) : tenant.billing_address ? (
                          <div className="flex items-center gap-1">
                            <MapPin size={14} className="text-gray-500 flex-shrink-0" />
                            <span className="text-xs">{tenant.billing_address}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-500">-</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => handleDelete(tenant.id)}
                            className="text-red-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-dark-700"
                            title="Verwijderen"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-dark-800 border-b border-amber-500">
            <h2 className="text-lg font-bold text-gray-100">
              Externe Huurders
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
            >
              <Plus size={20} />
              Externe Huurder Toevoegen
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                  <th className="text-left px-4 py-3 font-semibold w-[20%]">Bedrijf</th>
                  <th className="text-left px-4 py-3 font-semibold w-[15%]">Contactpersoon</th>
                  <th className="text-left px-4 py-3 font-semibold w-[18%]">Email</th>
                  <th className="text-left px-4 py-3 font-semibold w-[12%]">Telefoon</th>
                  <th className="text-left px-4 py-3 font-semibold w-[18%]">Adres</th>
                  <th className="text-center px-4 py-3 font-semibold w-[8%]">PIN</th>
                  <th className="text-right px-4 py-3 font-semibold w-[9%]">Acties</th>
                </tr>
              </thead>
              <tbody>
                {externalCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gold-600 bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-gold-500 font-bold text-sm">
                            {customer.company_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-gray-100 font-medium">{customer.company_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{customer.contact_name}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {customer.email ? (
                        <div className="flex items-center gap-1">
                          <Mail size={14} className="text-gold-500 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{customer.email}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {customer.phone ? (
                        <div className="flex items-center gap-1">
                          <Phone size={14} className="text-gold-500 flex-shrink-0" />
                          <span>{customer.phone}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      <div className="flex items-start gap-1">
                        <MapPin size={14} className="text-gold-500 flex-shrink-0 mt-0.5" />
                        <div className="leading-tight text-xs">
                          <div>{customer.street}</div>
                          <div className="text-gray-400">{customer.postal_code} {customer.city}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {customer.booking_pin_code ? (
                        <div className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-900 bg-opacity-20 px-2 py-1 rounded border border-green-700">
                          <Key size={12} />
                          <span>{customer.booking_pin_code}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleEditCustomer(customer)}
                          className="text-blue-400 hover:text-blue-300 transition-colors p-1.5 rounded hover:bg-dark-700"
                          title="Bewerken"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="text-red-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-dark-700"
                          title="Verwijderen"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'fulltime' && tenants.length === 0 && (
        <div className="bg-dark-900 rounded-lg p-8 text-center">
          <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Geen huurders gevonden</p>
        </div>
      )}

      {activeTab === 'inactive' && tenants.filter(t =>
        t.leases &&
        t.leases.length > 0 &&
        t.leases.every(l => l.status !== 'active')
      ).length === 0 && (
        <div className="bg-dark-900 rounded-lg p-8 text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <p className="text-gray-400">Geen afgelopen huurders gevonden</p>
        </div>
      )}

      {activeTab === 'external' && externalCustomers.length === 0 && (
        <div className="bg-dark-900 rounded-lg p-8 text-center">
          <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Nog geen externe huurders. Klik op "Externe Huurder Toevoegen" om je eerste externe huurder aan te maken.</p>
        </div>
      )}

      {showBookingOverview && (
        <BookingOverview
          customerId={showBookingOverview.customerId}
          customerType={showBookingOverview.customerType}
          customerName={showBookingOverview.customerName}
          onClose={() => setShowBookingOverview(null)}
        />
      )}
    </div>
  );
}
