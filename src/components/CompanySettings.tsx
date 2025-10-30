import { useState, useEffect } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { Building2, Edit2, Mail, Phone, MapPin, CreditCard, Lock, FolderOpen } from 'lucide-react';

export function CompanySettings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    address: '',
    postal_code: '',
    city: '',
    country: 'Nederland',
    phone: '',
    email: '',
    vat_number: '',
    kvk_number: '',
    bank_account: '',
    delete_code: '1234',
    root_folder_path: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error loading settings:', error);
    } else {
      setSettings(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (settings) {
      const { data, error } = await supabase
        .from('company_settings')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
      }
    } else {
      const { data, error } = await supabase
        .from('company_settings')
        .insert([formData])
        .select()
        .single();

      if (error) {
        console.error('Error creating settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
      }
    }

    setShowForm(false);
  };

  const handleEdit = () => {
    if (settings) {
      setFormData({
        company_name: settings.company_name || '',
        name: settings.name || '',
        address: settings.address || '',
        postal_code: settings.postal_code || '',
        city: settings.city || '',
        country: settings.country || 'Nederland',
        phone: settings.phone || '',
        email: settings.email || '',
        vat_number: settings.vat_number || '',
        kvk_number: settings.kvk_number || '',
        bank_account: settings.bank_account || '',
        delete_code: settings.delete_code || '1234',
        root_folder_path: settings.root_folder_path || ''
      });
    }
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      name: '',
      address: '',
      postal_code: '',
      city: '',
      country: 'Nederland',
      phone: '',
      email: '',
      vat_number: '',
      kvk_number: '',
      bank_account: '',
      delete_code: '1234',
      root_folder_path: ''
    });
    setShowForm(false);
  };

  const handleSelectFolder = async () => {
    if (window.electronAPI && window.electronAPI.selectFolder) {
      const result = await window.electronAPI.selectFolder();
      if (result.success && result.path) {
        setFormData({ ...formData, root_folder_path: result.path });
      }
    } else {
      console.warn('Folder selectie is alleen beschikbaar in de desktop applicatie');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Verhuurder gegevens laden...</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Building2 size={32} className="text-gold-500" />
        <h2 className="text-2xl font-bold text-gray-100">Verhuurder</h2>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {settings ? 'Verhuurder Bewerken' : 'Verhuurder Toevoegen'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-100 mb-3">Bedrijfsgegevens</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Bedrijfsnaam *
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
                      Naam
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="Naam van de verhuurder"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Adres
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Postcode
                      </label>
                      <input
                        type="text"
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Stad
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Land
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-100 mb-3">Contactgegevens</h4>
                <div className="grid grid-cols-2 gap-4">
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
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-100 mb-3">Financiële gegevens</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        BTW nummer
                      </label>
                      <input
                        type="text"
                        value={formData.vat_number}
                        onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                        placeholder="NL123456789B01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        KVK nummer
                      </label>
                      <input
                        type="text"
                        value={formData.kvk_number}
                        onChange={(e) => setFormData({ ...formData, kvk_number: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                        placeholder="12345678"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Bankrekeningnummer (IBAN)
                    </label>
                    <input
                      type="text"
                      value={formData.bank_account}
                      onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="NL00 BANK 0123 4567 89"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-gray-100 mb-3">Beveiliging</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Wis-code (voor het verwijderen van betaalde facturen)
                  </label>
                  <input
                    type="text"
                    value={formData.delete_code}
                    onChange={(e) => setFormData({ ...formData, delete_code: e.target.value })}
                    className="w-full px-3 py-2 border border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder="1234"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Deze code wordt gevraagd bij het verwijderen van betaalde facturen
                  </p>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4 mt-4">
                <h4 className="text-lg font-semibold text-gray-100 mb-3">Opslag Locatie</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Root Folder voor Facturen
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.root_folder_path}
                      onChange={(e) => setFormData({ ...formData, root_folder_path: e.target.value })}
                      className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="Selecteer een folder"
                      readOnly
                    />
                    <button
                      type="button"
                      onClick={handleSelectFolder}
                      className="flex items-center gap-2 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors border border-dark-600"
                    >
                      <FolderOpen size={18} />
                      Bladeren
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Hier worden automatisch folders aangemaakt per huurder en worden facturen opgeslagen
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 mt-4 border-t border-dark-700">
                <button
                  type="submit"
                  className="flex-1 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  {settings ? 'Bijwerken' : 'Aanmaken'}
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

      {settings ? (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6 max-w-3xl">
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

            {settings.root_folder_path && (
              <div>
                <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Opslag Locatie</h4>
                <div className="space-y-2 text-gray-200">
                  <div className="flex items-start gap-2">
                    <FolderOpen size={16} className="mt-0.5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-400">Root folder</p>
                      <p className="break-all">{settings.root_folder_path}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-12 max-w-3xl text-center">
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
