import { useState, useEffect } from 'react';
import { supabase, type CompanySettings, type WifiNetwork, type PatchPort, type Tenant } from '../lib/supabase';
import { Home, Edit2, Wifi, Network, FileText, Info, Save, X, Eye, EyeOff, User } from 'lucide-react';

export function BuildingInfo() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([]);
  const [patchPorts, setPatchPorts] = useState<PatchPort[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<'wifi' | 'patch' | 'building' | null>(null);
  const [showPasswords, setShowPasswords] = useState<{ [key: number]: boolean }>({});

  const [wifiFormData, setWifiFormData] = useState<{ [key: number]: { network_name: string; password: string; tenant_id: string | null } }>({});
  const [patchFormData, setPatchFormData] = useState<{ [key: string]: string }>({});
  const [buildingFormData, setBuildingFormData] = useState({
    meter_cabinet_info: '',
    building_notes: '',
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchSettings(),
        fetchWifiNetworks(),
        fetchPatchPorts(),
        fetchTenants(),
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();

    if (error) throw error;
    setSettings(data);
    if (data) {
      setBuildingFormData({
        meter_cabinet_info: data.meter_cabinet_info || '',
        building_notes: data.building_notes || '',
      });
    }
  };

  const fetchTenants = async () => {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('company_name');

    if (error) throw error;
    setTenants(data || []);
  };

  const fetchWifiNetworks = async () => {
    const { data, error } = await supabase
      .from('wifi_networks')
      .select('*')
      .order('network_number');

    if (error) throw error;
    setWifiNetworks(data || []);

    const formData: { [key: number]: { network_name: string; password: string; tenant_id: string | null } } = {};
    for (let i = 1; i <= 9; i++) {
      const network = data?.find(n => n.network_number === i);
      formData[i] = {
        network_name: network?.network_name || '',
        password: network?.password || '',
        tenant_id: network?.tenant_id || null,
      };
    }
    setWifiFormData(formData);
  };

  const fetchPatchPorts = async () => {
    const { data, error } = await supabase
      .from('patch_ports')
      .select('*')
      .order('switch_number, port_number');

    if (error) throw error;
    setPatchPorts(data || []);

    const formData: { [key: string]: string } = {};
    for (let switchNum = 1; switchNum <= 2; switchNum++) {
      for (let portNum = 1; portNum <= 24; portNum++) {
        const key = `${switchNum}-${portNum}`;
        const port = data?.find(p => p.switch_number === switchNum && p.port_number === portNum);
        formData[key] = port?.location_description || '';
      }
    }
    setPatchFormData(formData);
  };

  const handleSaveWifi = async () => {
    try {
      for (let i = 1; i <= 9; i++) {
        const network = wifiNetworks.find(n => n.network_number === i);
        const formValues = wifiFormData[i];

        if (network) {
          await supabase
            .from('wifi_networks')
            .update({
              network_name: formValues.network_name,
              password: formValues.password,
              tenant_id: formValues.tenant_id || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', network.id);
        } else {
          await supabase
            .from('wifi_networks')
            .insert([{
              network_number: i,
              network_name: formValues.network_name,
              password: formValues.password,
              tenant_id: formValues.tenant_id || null,
            }]);
        }
      }

      await fetchWifiNetworks();
      setEditingSection(null);
    } catch (error) {
      console.error('Error saving WiFi networks:', error);
      alert('Er is een fout opgetreden bij het opslaan');
    }
  };

  const handleSavePatch = async () => {
    try {
      for (let switchNum = 1; switchNum <= 2; switchNum++) {
        for (let portNum = 1; portNum <= 24; portNum++) {
          const key = `${switchNum}-${portNum}`;
          const port = patchPorts.find(p => p.switch_number === switchNum && p.port_number === portNum);
          const locationDesc = patchFormData[key];

          if (port) {
            await supabase
              .from('patch_ports')
              .update({
                location_description: locationDesc,
                updated_at: new Date().toISOString(),
              })
              .eq('id', port.id);
          } else if (locationDesc.trim()) {
            await supabase
              .from('patch_ports')
              .insert([{
                switch_number: switchNum,
                port_number: portNum,
                location_description: locationDesc,
              }]);
          }
        }
      }

      await fetchPatchPorts();
      setEditingSection(null);
    } catch (error) {
      console.error('Error saving patch ports:', error);
      alert('Er is een fout opgetreden bij het opslaan');
    }
  };

  const handleSaveBuilding = async () => {
    try {
      if (settings) {
        await supabase
          .from('company_settings')
          .update(buildingFormData)
          .eq('id', settings.id);
      } else {
        await supabase
          .from('company_settings')
          .insert([buildingFormData]);
      }

      await fetchSettings();
      setEditingSection(null);
    } catch (error) {
      console.error('Error saving building info:', error);
      alert('Er is een fout opgetreden bij het opslaan');
    }
  };

  const togglePasswordVisibility = (networkNumber: number) => {
    setShowPasswords(prev => ({
      ...prev,
      [networkNumber]: !prev[networkNumber]
    }));
  };

  const getTenantName = (tenantId: string | null) => {
    if (!tenantId) return null;
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant?.company_name || null;
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
      <div className="space-y-6">
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <Wifi size={24} className="text-gold-500" />
              <h3 className="text-xl font-semibold text-gray-100">WiFi Netwerken</h3>
            </div>
            {editingSection !== 'wifi' && (
              <button
                onClick={() => setEditingSection('wifi')}
                className="flex items-center gap-2 text-gold-500 hover:text-gold-400 transition-colors"
              >
                <Edit2 size={18} />
                Bewerken
              </button>
            )}
          </div>

          {editingSection === 'wifi' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <div key={num} className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Netwerk {num}</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Netwerk Naam</label>
                        <input
                          type="text"
                          value={wifiFormData[num]?.network_name || ''}
                          onChange={(e) => setWifiFormData({
                            ...wifiFormData,
                            [num]: { ...wifiFormData[num], network_name: e.target.value }
                          })}
                          placeholder="Bijv. HAL5-Kantoor"
                          className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Wachtwoord</label>
                        <input
                          type="text"
                          value={wifiFormData[num]?.password || ''}
                          onChange={(e) => setWifiFormData({
                            ...wifiFormData,
                            [num]: { ...wifiFormData[num], password: e.target.value }
                          })}
                          placeholder="Wachtwoord"
                          className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Huurder</label>
                        <select
                          value={wifiFormData[num]?.tenant_id || ''}
                          onChange={(e) => setWifiFormData({
                            ...wifiFormData,
                            [num]: { ...wifiFormData[num], tenant_id: e.target.value || null }
                          })}
                          className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                        >
                          <option value="">Geen huurder</option>
                          {tenants.map(tenant => (
                            <option key={tenant.id} value={tenant.id}>
                              {tenant.company_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  onClick={() => {
                    setEditingSection(null);
                    fetchWifiNetworks();
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
                >
                  <X size={18} />
                  Annuleren
                </button>
                <button
                  onClick={handleSaveWifi}
                  className="flex items-center gap-2 bg-gold-500 text-white px-6 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  <Save size={18} />
                  Opslaan
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                const network = wifiNetworks.find(n => n.network_number === num);
                const hasData = network && (network.network_name || network.password);
                const tenantName = network ? getTenantName(network.tenant_id) : null;

                return (
                  <div key={num} className={`bg-dark-800 rounded-lg p-4 border ${hasData ? 'border-dark-600' : 'border-dark-700 opacity-60'}`}>
                    <h4 className="text-sm font-semibold text-gray-400 mb-3">Netwerk {num}</h4>
                    {hasData ? (
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">Naam</p>
                          <p className="text-sm text-gray-200">{network.network_name || '-'}</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-gray-500">Wachtwoord</p>
                            <button
                              onClick={() => togglePasswordVisibility(num)}
                              className="text-gray-400 hover:text-gray-300"
                            >
                              {showPasswords[num] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          <p className="text-sm text-gray-200 font-mono">
                            {showPasswords[num] ? (network.password || '-') : '•'.repeat(network.password?.length || 8)}
                          </p>
                        </div>
                        {tenantName && (
                          <div>
                            <p className="text-xs text-gray-500">Huurder</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <User size={14} className="text-gold-500" />
                              <p className="text-sm text-gray-200">{tenantName}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Geen gegevens</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <Network size={24} className="text-gold-500" />
              <h3 className="text-xl font-semibold text-gray-100">Patch Panels</h3>
            </div>
            {editingSection !== 'patch' && (
              <button
                onClick={() => setEditingSection('patch')}
                className="flex items-center gap-2 text-gold-500 hover:text-gold-400 transition-colors"
              >
                <Edit2 size={18} />
                Bewerken
              </button>
            )}
          </div>

          {editingSection === 'patch' ? (
            <div className="space-y-6">
              {[1, 2].map((switchNum) => (
                <div key={switchNum} className="bg-dark-800 rounded-lg p-6 border border-dark-700">
                  <h4 className="text-lg font-semibold text-gray-200 mb-4">Switch {switchNum}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((portNum) => {
                      const key = `${switchNum}-${portNum}`;
                      return (
                        <div key={key} className="bg-dark-900 rounded p-3 border border-dark-600">
                          <label className="block text-xs font-medium text-gray-400 mb-2">
                            Poort {portNum}
                          </label>
                          <input
                            type="text"
                            value={patchFormData[key] || ''}
                            onChange={(e) => setPatchFormData({ ...patchFormData, [key]: e.target.value })}
                            placeholder="Locatie"
                            className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  onClick={() => {
                    setEditingSection(null);
                    fetchPatchPorts();
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
                >
                  <X size={18} />
                  Annuleren
                </button>
                <button
                  onClick={handleSavePatch}
                  className="flex items-center gap-2 bg-gold-500 text-white px-6 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  <Save size={18} />
                  Opslaan
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {[1, 2].map((switchNum) => {
                const switchPorts = patchPorts.filter(p => p.switch_number === switchNum && p.location_description);

                return (
                  <div key={switchNum} className="bg-dark-800 rounded-lg p-6 border border-dark-700">
                    <h4 className="text-lg font-semibold text-gray-200 mb-4">Switch {switchNum}</h4>
                    {switchPorts.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((portNum) => {
                          const port = patchPorts.find(p => p.switch_number === switchNum && p.port_number === portNum);
                          const hasLocation = port?.location_description;

                          return (
                            <div key={portNum} className={`bg-dark-900 rounded p-3 border ${hasLocation ? 'border-dark-600' : 'border-dark-700 opacity-40'}`}>
                              <p className="text-xs font-medium text-gray-400 mb-1">Poort {portNum}</p>
                              <p className="text-sm text-gray-200">{hasLocation || '-'}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Geen poorten geconfigureerd</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <Home size={24} className="text-gold-500" />
              <h3 className="text-xl font-semibold text-gray-100">Overige Pand Informatie</h3>
            </div>
            {editingSection !== 'building' && (
              <button
                onClick={() => setEditingSection('building')}
                className="flex items-center gap-2 text-gold-500 hover:text-gold-400 transition-colors"
              >
                <Edit2 size={18} />
                Bewerken
              </button>
            )}
          </div>

          {editingSection === 'building' ? (
            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <FileText size={18} />
                  Meterkast Indeling
                </label>
                <textarea
                  value={buildingFormData.meter_cabinet_info}
                  onChange={(e) => setBuildingFormData({ ...buildingFormData, meter_cabinet_info: e.target.value })}
                  placeholder="Beschrijf de indeling van de meterkast..."
                  rows={6}
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Info size={18} />
                  Algemene Notities
                </label>
                <textarea
                  value={buildingFormData.building_notes}
                  onChange={(e) => setBuildingFormData({ ...buildingFormData, building_notes: e.target.value })}
                  placeholder="Algemene informatie over het pand..."
                  rows={6}
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  onClick={() => {
                    setEditingSection(null);
                    fetchSettings();
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
                >
                  <X size={18} />
                  Annuleren
                </button>
                <button
                  onClick={handleSaveBuilding}
                  className="flex items-center gap-2 bg-gold-500 text-white px-6 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  <Save size={18} />
                  Opslaan
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {settings?.meter_cabinet_info ? (
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-400 uppercase mb-3">
                    <FileText size={16} />
                    Meterkast Indeling
                  </h4>
                  <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{settings.meter_cabinet_info}</p>
                  </div>
                </div>
              ) : null}

              {settings?.building_notes ? (
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-400 uppercase mb-3">
                    <Info size={16} />
                    Algemene Notities
                  </h4>
                  <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{settings.building_notes}</p>
                  </div>
                </div>
              ) : null}

              {!settings?.meter_cabinet_info && !settings?.building_notes && (
                <div className="text-center py-8">
                  <Home size={48} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-sm text-gray-400">Geen overige pand informatie beschikbaar</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
