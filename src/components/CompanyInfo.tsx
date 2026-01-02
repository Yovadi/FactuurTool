import { useState, useEffect } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { Building2, Edit2, Mail, Phone, MapPin, CreditCard, Lock } from 'lucide-react';

export function CompanyInfo() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    address: '',
    postal_code: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    vat_number: '',
    kvk_number: '',
    bank_account: '',
    delete_code: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (settings) {
      setFormData({
        company_name: settings.company_name || '',
        name: settings.name || '',
        address: settings.address || '',
        postal_code: settings.postal_code || '',
        city: settings.city || '',
        country: settings.country || '',
        phone: settings.phone || '',
        email: settings.email || '',
        vat_number: settings.vat_number || '',
        kvk_number: settings.kvk_number || '',
        bank_account: settings.bank_account || '',
        delete_code: settings.delete_code || '',
      });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (settings) {
        const { error } = await supabase
          .from('company_settings')
          .update(formData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert([formData]);

        if (error) throw error;
      }

      await fetchSettings();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Er is een fout opgetreden bij het opslaan van de gegevens');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-dark-700">
            <div className="p-6 border-b border-dark-700">
              <h3 className="text-xl font-semibold text-gray-100">
                {settings ? 'Bedrijfsgegevens Bewerken' : 'Verhuurder Toevoegen'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bedrijfsnaam *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Naam (optioneel)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Adres
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Postcode
                  </label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Plaats
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Land
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Telefoon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    BTW nummer
                  </label>
                  <input
                    type="text"
                    value={formData.vat_number}
                    onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    KVK nummer
                  </label>
                  <input
                    type="text"
                    value={formData.kvk_number}
                    onChange={(e) => setFormData({ ...formData, kvk_number: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    IBAN
                  </label>
                  <input
                    type="text"
                    value={formData.bank_account}
                    onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Wis-code (voor het verwijderen van gegevens)
                  </label>
                  <input
                    type="password"
                    value={formData.delete_code}
                    onChange={(e) => setFormData({ ...formData, delete_code: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="bg-gold-500 text-white px-6 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {settings ? (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-100">{settings.company_name}</h3>
              {settings.name && (
                <p className="text-gray-300 mt-1">{settings.name}</p>
              )}
            </div>
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 text-gold-500 hover:text-gold-400 transition-colors"
            >
              <Edit2 size={18} />
              Bewerken
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Adres</h4>
              <div className="space-y-1 text-gray-200">
                {settings.address && (
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="mt-1 text-gray-500" />
                    <div>
                      <p>{settings.address}</p>
                      <p>{settings.postal_code} {settings.city}</p>
                      <p>{settings.country}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Contact</h4>
              <div className="space-y-2 text-gray-200">
                {settings.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-500" />
                    <span>{settings.email}</span>
                  </div>
                )}
                {settings.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-gray-500" />
                    <span>{settings.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Financieel</h4>
              <div className="space-y-2 text-gray-200">
                {settings.vat_number && (
                  <div className="flex items-start gap-2">
                    <CreditCard size={16} className="mt-0.5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-400">BTW nummer</p>
                      <p>{settings.vat_number}</p>
                    </div>
                  </div>
                )}
                {settings.kvk_number && (
                  <div className="flex items-start gap-2">
                    <CreditCard size={16} className="mt-0.5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-400">KVK nummer</p>
                      <p>{settings.kvk_number}</p>
                    </div>
                  </div>
                )}
                {settings.bank_account && (
                  <div className="flex items-start gap-2">
                    <CreditCard size={16} className="mt-0.5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-400">IBAN</p>
                      <p>{settings.bank_account}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Beveiliging</h4>
              <div className="space-y-2 text-gray-200">
                {settings.delete_code && (
                  <div className="flex items-start gap-2">
                    <Lock size={16} className="mt-0.5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-400">Wis-code</p>
                      <p className="font-mono">{'•'.repeat(settings.delete_code.length)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-12 text-center">
          <Building2 size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-gray-400 mb-4">Nog geen verhuurder ingesteld</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-gold-500 text-white px-6 py-2 rounded-lg hover:bg-gold-600 transition-colors"
          >
            Verhuurder Toevoegen
          </button>
        </div>
      )}
    </div>
  );
}
