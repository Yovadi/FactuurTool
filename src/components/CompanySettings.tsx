import { useState, useEffect } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { Building2, Edit2, Mail, Phone, MapPin, CreditCard, Lock, FolderOpen, RefreshCw, Wifi, Network, Zap, FileText, Sparkles, Loader2 } from 'lucide-react';
import { EBoekhoudenDashboard } from './EBoekhoudenDashboard';

export function CompanySettings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'company' | 'building' | 'eboekhouden'>('company');
  const [showApiKey, setShowApiKey] = useState(false);

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
    root_folder_path: '',
    test_mode: false,
    test_date: '',
    wifi_network_name: '',
    wifi_password: '',
    patch_points: '',
    meter_cabinet_info: '',
    building_notes: '',
    openai_api_key: '',
    eboekhouden_api_token: '',
    eboekhouden_enabled: false
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
        root_folder_path: settings.root_folder_path || '',
        test_mode: settings.test_mode || false,
        test_date: settings.test_date || '',
        wifi_network_name: settings.wifi_network_name || '',
        wifi_password: settings.wifi_password || '',
        patch_points: settings.patch_points || '',
        meter_cabinet_info: settings.meter_cabinet_info || '',
        building_notes: settings.building_notes || '',
        openai_api_key: settings.openai_api_key || '',
        eboekhouden_api_token: settings.eboekhouden_api_token || '',
        eboekhouden_enabled: settings.eboekhouden_enabled || false
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
      root_folder_path: '',
      test_mode: false,
      test_date: '',
      wifi_network_name: '',
      wifi_password: '',
      patch_points: '',
      meter_cabinet_info: '',
      building_notes: '',
      openai_api_key: '',
      eboekhouden_api_token: '',
      eboekhouden_enabled: false
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

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);

    try {
      if ((window as any).electron?.checkForUpdates) {
        const result = await (window as any).electron.checkForUpdates();

        if (result.success) {
          setUpdateMessage('Update check gestart. Als er een update beschikbaar is, krijgt u een melding.');
        } else {
          setUpdateMessage(result.message || result.error || 'Kon niet checken voor updates');
        }
      } else {
        setUpdateMessage('Update functionaliteit is alleen beschikbaar in de desktop applicatie');
      }
    } catch (error: any) {
      setUpdateMessage(`Fout bij checken voor updates: ${error.message}`);
      console.error('Error checking for updates:', error);
    } finally {
      setCheckingUpdate(false);

      setTimeout(() => {
        setUpdateMessage(null);
      }, 5000);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Verhuurder gegevens laden...</div>;
  }

  return (
    <div className="h-full bg-dark-950 overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Building2 size={32} className="text-gold-500" />
        <h2 className="text-2xl font-bold text-gray-100">Verhuurder</h2>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-dark-700">
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
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
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

              <div className="border-t border-dark-700 pt-4 mt-4">
                <h4 className="text-lg font-semibold text-gray-100 mb-3">Test Modus</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="test_mode"
                      checked={formData.test_mode}
                      onChange={(e) => setFormData({ ...formData, test_mode: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-600 text-gold-500 focus:ring-gold-500"
                    />
                    <label htmlFor="test_mode" className="text-sm font-medium text-gray-200">
                      Activeer test modus
                    </label>
                  </div>
                  {formData.test_mode && (
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Test Datum
                      </label>
                      <input
                        type="date"
                        value={formData.test_date}
                        onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Deze datum wordt gebruikt in plaats van de huidige datum voor test doeleinden
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4 mt-4">
                <h4 className="text-lg font-semibold text-gray-100 mb-3">AI Instellingen</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    OpenAI API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.openai_api_key}
                      onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value })}
                      className="w-full px-3 py-2 pr-10 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 font-mono text-sm"
                      placeholder="sk-..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Nodig voor automatische herkenning van inkoopfacturen via AI (GPT-4 Vision)
                  </p>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-4 mt-4">
                <h4 className="text-lg font-semibold text-gray-100 mb-3">Pand Informatie</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        WiFi Netwerk Naam
                      </label>
                      <input
                        type="text"
                        value={formData.wifi_network_name}
                        onChange={(e) => setFormData({ ...formData, wifi_network_name: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                        placeholder="SSID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        WiFi Wachtwoord
                      </label>
                      <input
                        type="text"
                        value={formData.wifi_password}
                        onChange={(e) => setFormData({ ...formData, wifi_password: e.target.value })}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                        placeholder="Wachtwoord"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Patchpunten
                    </label>
                    <textarea
                      value={formData.patch_points}
                      onChange={(e) => setFormData({ ...formData, patch_points: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      rows={3}
                      placeholder="Beschrijving van netwerk patchpunten en aansluitingen"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Meterkast Indeling
                    </label>
                    <textarea
                      value={formData.meter_cabinet_info}
                      onChange={(e) => setFormData({ ...formData, meter_cabinet_info: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      rows={3}
                      placeholder="Beschrijving van meterkast indeling en groepenverdeling"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Algemene Notities
                    </label>
                    <textarea
                      value={formData.building_notes}
                      onChange={(e) => setFormData({ ...formData, building_notes: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      rows={4}
                      placeholder="Aanvullende informatie over het pand"
                    />
                  </div>
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
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 max-w-3xl">
          <div className="flex justify-between items-start p-6 pb-0">
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

          <div className="flex border-b border-dark-700 px-6 mt-4">
            <button
              onClick={() => setActiveTab('company')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'company'
                  ? 'text-gold-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Bedrijfsgegevens
              {activeTab === 'company' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('building')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'building'
                  ? 'text-gold-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Pand Informatie
              {activeTab === 'building' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500"></div>
              )}
            </button>
            {settings.eboekhouden_enabled && (
              <button
                onClick={() => setActiveTab('eboekhouden')}
                className={`px-4 py-3 font-medium transition-colors relative ${
                  activeTab === 'eboekhouden'
                    ? 'text-gold-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                e-Boekhouden
                {activeTab === 'eboekhouden' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500"></div>
                )}
              </button>
            )}
          </div>

          <div className="p-6">
            <div className={activeTab !== 'company' ? 'hidden' : ''}>
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

                {settings.test_mode && (
                  <div className="border-t border-dark-700 pt-4">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Test Modus</h4>
                    <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                      <p className="text-yellow-200 text-sm font-medium mb-1">Test modus actief</p>
                      {settings.test_date && (
                        <p className="text-gray-300 text-sm">
                          Gesimuleerde datum: {new Date(settings.test_date).toLocaleDateString('nl-NL', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-dark-700 pt-6">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">AI Instellingen</h4>
                  <div className="space-y-2 text-gray-200">
                    <div className="flex items-start gap-2">
                      <Sparkles size={16} className="mt-0.5 text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-400">OpenAI API Key</p>
                        <p className="font-mono text-sm">
                          {settings.openai_api_key
                            ? `sk-...${settings.openai_api_key.slice(-4)}`
                            : 'Niet ingesteld'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-dark-700 pt-6">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">e-Boekhouden Koppeling</h4>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${settings.eboekhouden_enabled ? (settings.eboekhouden_connected ? 'bg-green-500' : 'bg-amber-500') : 'bg-gray-600'}`} />
                    <span className="text-sm text-gray-300">
                      {settings.eboekhouden_enabled
                        ? settings.eboekhouden_connected
                          ? 'Verbonden en actief'
                          : 'Geactiveerd, nog niet verbonden'
                        : 'Niet geactiveerd'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-dark-700 pt-6">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Software Updates</h4>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCheckForUpdates}
                      disabled={checkingUpdate}
                      className="flex items-center gap-2 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors border border-dark-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw size={18} className={checkingUpdate ? 'animate-spin' : ''} />
                      {checkingUpdate ? 'Checken...' : 'Check voor Updates'}
                    </button>
                    {updateMessage && (
                      <p className="text-sm text-gray-300">{updateMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={activeTab !== 'building' ? 'hidden' : ''}>
              <div className="space-y-6">
                {(settings.wifi_network_name || settings.wifi_password) ? (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">WiFi Toegang</h4>
                    <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                      <div className="flex items-center gap-2 mb-3">
                        <Wifi size={20} className="text-gold-500" />
                        <span className="font-medium text-gray-100">WiFi Netwerk</span>
                      </div>
                      {settings.wifi_network_name && (
                        <div className="mb-2">
                          <span className="text-xs text-gray-400 block mb-1">Netwerk naam (SSID)</span>
                          <span className="text-sm text-gray-200">{settings.wifi_network_name}</span>
                        </div>
                      )}
                      {settings.wifi_password && (
                        <div>
                          <span className="text-xs text-gray-400 block mb-1">Wachtwoord</span>
                          <span className="text-sm font-mono text-gray-200">{settings.wifi_password}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Wifi size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Geen WiFi informatie beschikbaar</p>
                  </div>
                )}

                {settings.patch_points && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Patchpunten</h4>
                    <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                      <div className="flex items-start gap-2 mb-2">
                        <Network size={20} className="text-gold-500 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-medium text-gray-100 block mb-2">Netwerk Aansluitingen</span>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{settings.patch_points}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settings.meter_cabinet_info && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Meterkast</h4>
                    <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                      <div className="flex items-start gap-2 mb-2">
                        <Zap size={20} className="text-gold-500 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-medium text-gray-100 block mb-2">Meterkast Indeling</span>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{settings.meter_cabinet_info}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settings.building_notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Algemene Notities</h4>
                    <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                      <div className="flex items-start gap-2 mb-2">
                        <FileText size={20} className="text-gold-500 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-medium text-gray-100 block mb-2">Overige Informatie</span>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{settings.building_notes}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!settings.wifi_network_name && !settings.wifi_password && !settings.patch_points && !settings.meter_cabinet_info && !settings.building_notes && (
                  <div className="text-center py-12 text-gray-400">
                    <Building2 size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Geen pand informatie beschikbaar</p>
                    <p className="text-xs mt-1">Klik op "Bewerken" om informatie toe te voegen</p>
                  </div>
                )}
              </div>
            </div>

            <div className={activeTab !== 'eboekhouden' ? 'hidden' : ''}>
              <EBoekhoudenDashboard
                settings={settings}
                onSettingsUpdate={(updated) => setSettings(updated)}
              />
            </div>
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
