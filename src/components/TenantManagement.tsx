import { useState, useEffect } from 'react';
import { supabase, type Tenant } from '../lib/supabase';
import { Plus, Edit2, Trash2, Mail, Phone, MapPin } from 'lucide-react';

export function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    billing_address: ''
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading tenants:', error);
    } else {
      setTenants(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingTenant) {
      const { error } = await supabase
        .from('tenants')
        .update(formData)
        .eq('id', editingTenant.id);

      if (error) {
        console.error('Error updating tenant:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('tenants')
        .insert([formData]);

      if (error) {
        console.error('Error creating tenant:', error);
        return;
      }
    }

    resetForm();
    loadTenants();
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      company_name: tenant.company_name,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone || '',
      billing_address: tenant.billing_address || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze huurder wilt verwijderen?')) return;

    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tenant:', error);
    } else {
      loadTenants();
    }
  };

  const resetForm = () => {
    setFormData({ company_name: '', name: '', email: '', phone: '', billing_address: '' });
    setEditingTenant(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="text-center py-8">Huurders laden...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100">Huurders</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
        >
          <Plus size={20} />
          Huurder Toevoegen
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {editingTenant ? 'Huurder Bewerken' : 'Nieuwe Huurder Toevoegen'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Bedrijfsnaam
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Contactpersoon
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Telefoon
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Factuuradres
                </label>
                <textarea
                  value={formData.billing_address}
                  onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  {editingTenant ? 'Bijwerken' : 'Aanmaken'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map((tenant) => (
          <div
            key={tenant.id}
            className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-gray-100">{tenant.company_name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(tenant)}
                  className="text-gold-500 hover:text-gold-400 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(tenant.id)}
                  className="text-red-600 hover:text-red-800 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              {tenant.name && (
                <div className="text-gray-200 font-medium">
                  {tenant.name}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Mail size={14} />
                <span>{tenant.email}</span>
              </div>
              {tenant.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} />
                  <span>{tenant.phone}</span>
                </div>
              )}
              {tenant.billing_address && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5" />
                  <span className="flex-1">{tenant.billing_address}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {tenants.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Nog geen huurders. Klik op "Huurder Toevoegen" om je eerste huurder aan te maken.
        </div>
      )}
    </div>
  );
}
