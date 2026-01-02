import { useState, useEffect } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { Building2, Edit2, Wifi, Network, Zap, FileText } from 'lucide-react';

export function BuildingInfo() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    wifi_network_name: '',
    wifi_password: '',
    patch_points: '',
    meter_cabinet_info: '',
    building_notes: '',
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
        wifi_network_name: settings.wifi_network_name || '',
        wifi_password: settings.wifi_password || '',
        patch_points: settings.patch_points || '',
        meter_cabinet_info: settings.meter_cabinet_info || '',
        building_notes: settings.building_notes || '',
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
                Pand Informatie Bewerken
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    WiFi Netwerk Naam (SSID)
                  </label>
                  <input
                    type="text"
                    value={formData.wifi_network_name}
                    onChange={(e) => setFormData({ ...formData, wifi_network_name: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    WiFi Wachtwoord
                  </label>
                  <input
                    type="text"
                    value={formData.wifi_password}
                    onChange={(e) => setFormData({ ...formData, wifi_password: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Patchpunten / Netwerk Aansluitingen
                  </label>
                  <textarea
                    value={formData.patch_points}
                    onChange={(e) => setFormData({ ...formData, patch_points: e.target.value })}
                    rows={4}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder="bijv. Ruimte 101: Patch 1-4&#10;Ruimte 102: Patch 5-8"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Meterkast Indeling
                  </label>
                  <textarea
                    value={formData.meter_cabinet_info}
                    onChange={(e) => setFormData({ ...formData, meter_cabinet_info: e.target.value })}
                    rows={4}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder="bijv. Groep 1-3: Verlichting&#10;Groep 4-6: Stopcontacten"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Algemene Notities
                  </label>
                  <textarea
                    value={formData.building_notes}
                    onChange={(e) => setFormData({ ...formData, building_notes: e.target.value })}
                    rows={4}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder="Overige informatie over het pand..."
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
            <h3 className="text-xl font-semibold text-gray-100">Pand Informatie</h3>
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 text-gold-500 hover:text-gold-400 transition-colors"
            >
              <Edit2 size={18} />
              Bewerken
            </button>
          </div>

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
      ) : (
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-12 text-center">
          <Building2 size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-gray-400 mb-4">Nog geen pand informatie ingesteld</p>
          <p className="text-xs text-gray-500">Ga eerst naar Bedrijfsgegevens om verhuurder toe te voegen</p>
        </div>
      )}
    </div>
  );
}
