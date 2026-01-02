import { useState, useEffect } from 'react';
import { supabase, type CompanySettings, type WifiNetwork, type PatchPort, type MeterGroup, type Tenant } from '../lib/supabase';
import { Home, Edit2, Wifi, Network, FileText, Info, Save, X, Eye, EyeOff, User, Zap, Download } from 'lucide-react';
import { generateBuildingInfoPDF } from '../utils/pdfGenerator';

export function BuildingInfo() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([]);
  const [patchPorts, setPatchPorts] = useState<PatchPort[]>([]);
  const [meterGroups, setMeterGroups] = useState<MeterGroup[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<'wifi' | 'patch' | 'meter' | 'building' | null>(null);
  const [showPasswords, setShowPasswords] = useState<{ [key: number]: boolean }>({});

  const [wifiFormData, setWifiFormData] = useState<{ [key: number]: { network_name: string; password: string; tenant_id: string | null } }>({});
  const [patchFormData, setPatchFormData] = useState<{ [key: string]: { location_type: string; location_number: string; notes: string } }>({});
  const [meterFormData, setMeterFormData] = useState<{ [alaGroup: string]: { [entryId: string]: { group_number: number; location_type: string; location_number: string; description: string } } }>({});
  const [buildingFormData, setBuildingFormData] = useState({
    meter_cabinet_info: '',
    building_notes: '',
  });
  const [selectedAla, setSelectedAla] = useState('ALA1');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchSettings(),
        fetchWifiNetworks(),
        fetchPatchPorts(),
        fetchMeterGroups(),
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

    const formData: { [key: string]: { location_type: string; location_number: string; notes: string } } = {};
    for (let switchNum = 1; switchNum <= 2; switchNum++) {
      for (let portNum = 1; portNum <= 24; portNum++) {
        const key = `${switchNum}-${portNum}`;
        const port = data?.find(p => p.switch_number === switchNum && p.port_number === portNum);
        formData[key] = {
          location_type: port?.location_type || '',
          location_number: port?.location_number?.toString() || '',
          notes: port?.notes || '',
        };
      }
    }
    setPatchFormData(formData);
  };

  const fetchMeterGroups = async () => {
    const { data, error } = await supabase
      .from('meter_groups')
      .select('*')
      .order('ala_group, group_number, location_number');

    if (error) throw error;
    setMeterGroups(data || []);

    const formData: { [alaGroup: string]: { [entryId: string]: { group_number: number; location_type: string; location_number: string; description: string } } } = {};
    data?.forEach(group => {
      if (!formData[group.ala_group]) {
        formData[group.ala_group] = {};
      }
      formData[group.ala_group][group.id] = {
        group_number: group.group_number,
        location_type: group.location_type || '',
        location_number: group.location_number?.toString() || '',
        description: group.description || '',
      };
    });
    setMeterFormData(formData);
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
          const formValues = patchFormData[key];

          const hasData = formValues.location_type || formValues.notes.trim();

          if (port) {
            if (hasData) {
              await supabase
                .from('patch_ports')
                .update({
                  location_type: formValues.location_type || null,
                  location_number: formValues.location_number ? parseInt(formValues.location_number) : null,
                  notes: formValues.notes,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', port.id);
            } else {
              await supabase
                .from('patch_ports')
                .delete()
                .eq('id', port.id);
            }
          } else if (hasData) {
            await supabase
              .from('patch_ports')
              .insert([{
                switch_number: switchNum,
                port_number: portNum,
                location_type: formValues.location_type || null,
                location_number: formValues.location_number ? parseInt(formValues.location_number) : null,
                notes: formValues.notes,
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

  const handleSaveMeter = async () => {
    try {
      for (const alaGroup of Object.keys(meterFormData)) {
        const entries = meterFormData[alaGroup];

        for (const entryId of Object.keys(entries)) {
          const formValues = entries[entryId];
          const hasData = formValues?.location_type || formValues?.description?.trim();

          if (entryId.startsWith('new-')) {
            if (hasData) {
              await supabase
                .from('meter_groups')
                .insert([{
                  ala_group: alaGroup,
                  group_number: formValues.group_number,
                  location_type: formValues.location_type || null,
                  location_number: formValues.location_number ? parseInt(formValues.location_number) : null,
                  description: formValues.description,
                }]);
            }
          } else {
            const existingGroup = meterGroups.find(g => g.id === entryId);
            if (existingGroup) {
              if (hasData) {
                await supabase
                  .from('meter_groups')
                  .update({
                    ala_group: alaGroup,
                    group_number: formValues.group_number,
                    location_type: formValues.location_type || null,
                    location_number: formValues.location_number ? parseInt(formValues.location_number) : null,
                    description: formValues.description,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', entryId);
              } else {
                await supabase
                  .from('meter_groups')
                  .delete()
                  .eq('id', entryId);
              }
            }
          }
        }
      }

      await fetchMeterGroups();
      setEditingSection(null);
    } catch (error) {
      console.error('Error saving meter groups:', error);
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

  const handleExportPDF = async () => {
    try {
      const wifiData = wifiNetworks.map(network => ({
        network_number: network.network_number,
        network_name: network.network_name,
        password: network.password,
        tenant_name: getTenantName(network.tenant_id) || undefined,
      }));

      const patchData = patchPorts.map(port => ({
        switch_number: port.switch_number,
        port_number: port.port_number,
        location_type: port.location_type || undefined,
        location_number: port.location_number || undefined,
        notes: port.notes || undefined,
      }));

      const meterData = meterGroups.map(group => ({
        ala_group: group.ala_group,
        group_number: group.group_number,
        location_type: group.location_type || undefined,
        location_number: group.location_number || undefined,
        description: group.description || undefined,
      }));

      await generateBuildingInfoPDF({
        company: settings ? {
          name: settings.company_name || 'HAL5 Overloon',
          address: settings.address,
          postal_code: settings.postal_code,
          city: settings.city,
        } : undefined,
        wifiNetworks: wifiData,
        patchPorts: patchData,
        meterGroups: meterData,
        meterCabinetInfo: settings?.meter_cabinet_info,
        buildingNotes: settings?.building_notes,
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Er is een fout opgetreden bij het exporteren');
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
      <div className="space-y-6">
        <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-100">Pand Informatie</h2>
              <p className="text-sm text-gray-400 mt-1">Beheer WiFi netwerken, patch poorten en meterkast groepen</p>
            </div>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
            >
              <Download size={18} />
              Exporteer PDF
            </button>
          </div>
        </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <div key={num} className="bg-dark-800 rounded-lg p-3 border border-dark-700">
                    <h4 className="text-xs font-semibold text-gray-300 mb-2">Netwerk {num}</h4>
                    <div className="space-y-2">
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
                          className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
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
                          className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
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
                          className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                const network = wifiNetworks.find(n => n.network_number === num);
                const hasData = network && (network.network_name || network.password);
                const tenantName = network ? getTenantName(network.tenant_id) : null;

                return (
                  <div key={num} className={`bg-dark-800 rounded-lg p-3 border ${hasData ? 'border-dark-600' : 'border-dark-700 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-400">Netwerk {num}</h4>
                      {hasData && (
                        <button
                          onClick={() => togglePasswordVisibility(num)}
                          className="text-gray-400 hover:text-gray-300"
                        >
                          {showPasswords[num] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                    </div>
                    {hasData ? (
                      <div className="space-y-1.5">
                        <div>
                          <p className="text-xs font-medium text-gray-200 truncate">{network.network_name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-200 font-mono truncate">
                            {showPasswords[num] ? (network.password || '-') : '•'.repeat(Math.min(network.password?.length || 8, 12))}
                          </p>
                        </div>
                        {tenantName && (
                          <div className="flex items-center gap-1 pt-1 border-t border-dark-700">
                            <User size={10} className="text-gold-500 flex-shrink-0" />
                            <p className="text-xs text-gray-300 truncate">{tenantName}</p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((portNum) => {
                      const key = `${switchNum}-${portNum}`;
                      const formValues = patchFormData[key] || { location_type: '', location_number: '', notes: '' };
                      return (
                        <div key={key} className="bg-dark-900 rounded p-3 border border-dark-600">
                          <label className="block text-xs font-medium text-gray-400 mb-2">
                            Poort {portNum}
                          </label>
                          <div className="space-y-2">
                            <select
                              value={formValues.location_type}
                              onChange={(e) => setPatchFormData({
                                ...patchFormData,
                                [key]: { ...formValues, location_type: e.target.value, location_number: '' }
                              })}
                              className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500"
                            >
                              <option value="">Geen toewijzing</option>
                              <option value="kantoor">Kantoor</option>
                              <option value="bedrijfshal">Bedrijfshal</option>
                              <option value="eigen_gebruik">Eigen gebruik</option>
                            </select>

                            {formValues.location_type === 'kantoor' && (
                              <select
                                value={formValues.location_number}
                                onChange={(e) => setPatchFormData({
                                  ...patchFormData,
                                  [key]: { ...formValues, location_number: e.target.value }
                                })}
                                className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500"
                              >
                                <option value="">Selecteer kantoor</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                                  <option key={num} value={num}>Kantoor {num}</option>
                                ))}
                              </select>
                            )}

                            {formValues.location_type === 'bedrijfshal' && (
                              <select
                                value={formValues.location_number}
                                onChange={(e) => setPatchFormData({
                                  ...patchFormData,
                                  [key]: { ...formValues, location_number: e.target.value }
                                })}
                                className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500"
                              >
                                <option value="">Selecteer hal</option>
                                {[1, 2, 3, 4].map(num => (
                                  <option key={num} value={num}>Hal {num}</option>
                                ))}
                              </select>
                            )}

                            <input
                              type="text"
                              value={formValues.notes}
                              onChange={(e) => setPatchFormData({
                                ...patchFormData,
                                [key]: { ...formValues, notes: e.target.value }
                              })}
                              placeholder="Notities (optioneel)"
                              className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500"
                            />
                          </div>
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
                const switchPorts = patchPorts.filter(p => p.switch_number === switchNum && (p.location_type || p.notes));

                return (
                  <div key={switchNum} className="bg-dark-800 rounded-lg p-6 border border-dark-700">
                    <h4 className="text-lg font-semibold text-gray-200 mb-4">Switch {switchNum}</h4>
                    {switchPorts.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((portNum) => {
                          const port = patchPorts.find(p => p.switch_number === switchNum && p.port_number === portNum);
                          const hasData = port && (port.location_type || port.notes);

                          let locationLabel = '-';
                          if (port?.location_type === 'kantoor' && port.location_number) {
                            locationLabel = `Kantoor ${port.location_number}`;
                          } else if (port?.location_type === 'bedrijfshal' && port.location_number) {
                            locationLabel = `Hal ${port.location_number}`;
                          } else if (port?.location_type === 'eigen_gebruik') {
                            locationLabel = 'Eigen gebruik';
                          } else if (port?.notes) {
                            locationLabel = 'Notitie';
                          }

                          return (
                            <div key={portNum} className={`bg-dark-900 rounded p-2 border ${hasData ? 'border-dark-600' : 'border-dark-700 opacity-40'}`}>
                              <p className="text-xs font-medium text-gray-400 mb-1">Poort {portNum}</p>
                              <p className="text-xs text-gray-200 font-medium">{locationLabel}</p>
                              {port?.notes && (
                                <p className="text-xs text-gray-400 mt-1 truncate" title={port.notes}>
                                  {port.notes}
                                </p>
                              )}
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
              <Zap size={24} className="text-gold-500" />
              <h3 className="text-xl font-semibold text-gray-100">Meterkast Groepen</h3>
            </div>
            {editingSection !== 'meter' && (
              <button
                onClick={() => setEditingSection('meter')}
                className="flex items-center gap-2 text-gold-500 hover:text-gold-400 transition-colors"
              >
                <Edit2 size={18} />
                Bewerken
              </button>
            )}
          </div>

          {editingSection === 'meter' ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-dark-700">
                <label className="text-sm font-medium text-gray-300">ALA Groep:</label>
                <select
                  value={selectedAla}
                  onChange={(e) => setSelectedAla(e.target.value)}
                  className="bg-dark-800 border border-dark-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  {Array.from({ length: 10 }, (_, i) => `ALA${i + 1}`).map(ala => (
                    <option key={ala} value={ala}>{ala}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                {Array.from({ length: 50 }, (_, i) => i + 1).map((groupNum) => {
                  const currentAlaData = meterFormData[selectedAla] || {};
                  const entries = Object.entries(currentAlaData).filter(([_, data]) => data.group_number === groupNum);
                  const hasEntries = entries.length > 0;

                  if (!hasEntries && groupNum > Math.max(0, ...Object.values(currentAlaData).map(d => d.group_number)) + 3) {
                    return null;
                  }

                  return (
                    <div key={groupNum} className="bg-dark-800 rounded-lg p-4 border border-dark-600">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-medium text-gray-300">Groep K{groupNum}</h4>
                        <button
                          onClick={() => {
                            const newId = `new-${Date.now()}-${Math.random()}`;
                            setMeterFormData({
                              ...meterFormData,
                              [selectedAla]: {
                                ...currentAlaData,
                                [newId]: { group_number: groupNum, location_type: '', location_number: '', description: '' }
                              }
                            });
                          }}
                          className="text-xs text-gold-500 hover:text-gold-400 transition-colors"
                        >
                          + Kantoor toevoegen
                        </button>
                      </div>

                      <div className="space-y-3">
                        {entries.map(([entryId, formValues]) => (
                          <div key={entryId} className="bg-dark-900 rounded p-3 border border-dark-700">
                            <div className="space-y-2">
                              <select
                                value={formValues.location_type}
                                onChange={(e) => setMeterFormData({
                                  ...meterFormData,
                                  [selectedAla]: {
                                    ...currentAlaData,
                                    [entryId]: { ...formValues, location_type: e.target.value, location_number: '' }
                                  }
                                })}
                                className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                              >
                                <option value="">Geen toewijzing</option>
                                <option value="kantoor">Kantoor</option>
                                <option value="eigen_gebruik">Eigen gebruik</option>
                              </select>

                              {formValues.location_type === 'kantoor' && (
                                <select
                                  value={formValues.location_number}
                                  onChange={(e) => setMeterFormData({
                                    ...meterFormData,
                                    [selectedAla]: {
                                      ...currentAlaData,
                                      [entryId]: { ...formValues, location_number: e.target.value }
                                    }
                                  })}
                                  className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                                >
                                  <option value="">Selecteer kantoor</option>
                                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                                    <option key={num} value={num}>Kantoor {num}</option>
                                  ))}
                                </select>
                              )}

                              <input
                                type="text"
                                value={formValues.description}
                                onChange={(e) => setMeterFormData({
                                  ...meterFormData,
                                  [selectedAla]: {
                                    ...currentAlaData,
                                    [entryId]: { ...formValues, description: e.target.value }
                                  }
                                })}
                                placeholder="Beschrijving (optioneel)"
                                className="w-full bg-dark-800 border border-dark-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                              />

                              <button
                                onClick={() => {
                                  const newAlaData = { ...currentAlaData };
                                  delete newAlaData[entryId];
                                  setMeterFormData({
                                    ...meterFormData,
                                    [selectedAla]: newAlaData
                                  });
                                }}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                              >
                                Verwijderen
                              </button>
                            </div>
                          </div>
                        ))}

                        {!hasEntries && (
                          <p className="text-xs text-gray-500 text-center py-2">Nog geen kantoren toegewezen</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  onClick={() => {
                    setEditingSection(null);
                    fetchMeterGroups();
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
                >
                  <X size={18} />
                  Annuleren
                </button>
                <button
                  onClick={handleSaveMeter}
                  className="flex items-center gap-2 bg-gold-500 text-white px-6 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  <Save size={18} />
                  Opslaan
                </button>
              </div>
            </div>
          ) : (
            <div>
              {meterGroups.length > 0 ? (
                <div className="space-y-6">
                  {Array.from(new Set(meterGroups.map(g => g.ala_group))).sort().map(alaGroup => {
                    const alaGroups = meterGroups.filter(g => g.ala_group === alaGroup);
                    const groupedByK = alaGroups.reduce((acc, group) => {
                      if (!acc[group.group_number]) {
                        acc[group.group_number] = [];
                      }
                      acc[group.group_number].push(group);
                      return acc;
                    }, {} as { [key: number]: MeterGroup[] });

                    return (
                      <div key={alaGroup} className="border border-dark-700 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gold-500 mb-3">{alaGroup}</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                          {Object.entries(groupedByK).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([groupNum, groups]) => (
                            <div key={groupNum} className="bg-dark-800 rounded p-3 border border-dark-600">
                              <p className="text-xs font-medium text-gray-400 mb-2">K{groupNum}</p>
                              <div className="space-y-1">
                                {groups.map(group => {
                                  let locationLabel = '-';
                                  if (group.location_type === 'kantoor' && group.location_number) {
                                    locationLabel = `Kantoor ${group.location_number}`;
                                  } else if (group.location_type === 'eigen_gebruik') {
                                    locationLabel = 'Eigen gebruik';
                                  }

                                  return (
                                    <div key={group.id}>
                                      <p className="text-xs text-gray-200 font-medium">{locationLabel}</p>
                                      {group.description && (
                                        <p className="text-xs text-gray-400 truncate" title={group.description}>
                                          {group.description}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Geen groepen geconfigureerd</p>
              )}
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
