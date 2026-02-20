import { useState, useEffect } from 'react';
import { supabase, type CompanySettings, type WifiNetwork, type PatchPort, type MeterGroup, type RcboCircuitBreaker, type Tenant } from '../lib/supabase';
import { Home, Edit2, Wifi, Network, FileText, Info, Save, X, Eye, EyeOff, User, Zap, Download } from 'lucide-react';
import { generateBuildingInfoPDF } from '../utils/pdfGenerator';

const TENANT_COLORS = [
  '#EF4444', // red-500
  '#F59E0B', // amber-500
  '#10B981', // emerald-500
  '#3B82F6', // blue-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#14B8A6', // teal-500
  '#F97316', // orange-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
];

const SPACE_COLORS = {
  eigen: '#6B7280',        // gray-500 - Eigen gebruik
  spreekkamer: '#A855F7',  // purple-500 - Spreekkamer
  flexplek: '#22D3EE',     // cyan-400 - Flexplek
};

export function BuildingInfo() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([]);
  const [patchPorts, setPatchPorts] = useState<PatchPort[]>([]);
  const [meterGroups, setMeterGroups] = useState<MeterGroup[]>([]);
  const [rcboBreakers, setRcboBreakers] = useState<RcboCircuitBreaker[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<'wifi' | 'patch' | 'meter' | 'building' | null>(null);
  const [showPasswords, setShowPasswords] = useState<{ [key: number]: boolean }>({});

  const [wifiFormData, setWifiFormData] = useState<{ [key: number]: { network_name: string; password: string; tenant_id: string | null; assignment_type: 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek' } }>({});
  const [patchFormData, setPatchFormData] = useState<{ [key: string]: { tenant_id: string | null; assignment_type: 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek'; notes: string } }>({});
  const [meterFormData, setMeterFormData] = useState<{ [alaGroup: string]: { [groupNumber: number]: { group_number: number; tenant_id: string | null; assignment_type: 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek'; description: string } } }>({});
  const [rcboFormData, setRcboFormData] = useState<{ [alaGroup: string]: { [key: number]: { tenant_id: string | null; assignment_type: 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek'; description: string } } }>({});
  const [alaType, setAlaType] = useState<{ [alaGroup: string]: 'groups' | 'rcbo' }>({});
  const [originalAlaType, setOriginalAlaType] = useState<{ [alaGroup: string]: 'groups' | 'rcbo' }>({});
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
        fetchRcboBreakers(),
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

    const formData: { [key: number]: { network_name: string; password: string; tenant_id: string | null; assignment_type: 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek' } } = {};
    for (let i = 1; i <= 9; i++) {
      const network = data?.find(n => n.network_number === i);
      formData[i] = {
        network_name: network?.network_name || '',
        password: network?.password || '',
        tenant_id: network?.tenant_id || null,
        assignment_type: network?.assignment_type || 'eigen',
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

    const formData: { [key: string]: { tenant_id: string | null; assignment_type: 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek'; notes: string } } = {};
    for (let switchNum = 1; switchNum <= 2; switchNum++) {
      for (let portNum = 1; portNum <= 24; portNum++) {
        const key = `${switchNum}-${portNum}`;
        const port = data?.find(p => p.switch_number === switchNum && p.port_number === portNum);
        formData[key] = {
          tenant_id: port?.tenant_id || null,
          assignment_type: port?.assignment_type || 'eigen',
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
      .order('ala_group, group_number');

    if (error) throw error;
    setMeterGroups(data || []);

    const formData: { [alaGroup: string]: { [groupNumber: number]: { group_number: number; tenant_id: string | null; assignment_type: 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek'; description: string } } } = {};
    data?.forEach(group => {
      if (!formData[group.ala_group]) {
        formData[group.ala_group] = {};
      }
      formData[group.ala_group][group.group_number] = {
        group_number: group.group_number,
        tenant_id: group.tenant_id || null,
        assignment_type: group.assignment_type || 'eigen',
        description: group.description || '',
      };
    });
    setMeterFormData(formData);
  };

  const fetchRcboBreakers = async () => {
    const { data, error } = await supabase
      .from('rcbo_circuit_breakers')
      .select('*')
      .order('ala_group, rcbo_number');

    if (error) throw error;
    setRcboBreakers(data || []);

    const formData: { [alaGroup: string]: { [key: number]: { tenant_id: string | null; assignment_type: 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek'; description: string } } } = {};
    const types: { [alaGroup: string]: 'groups' | 'rcbo' } = {};

    for (let alaNum = 1; alaNum <= 10; alaNum++) {
      const alaGroup = `ALA${alaNum}`;
      formData[alaGroup] = {};

      const alaRcbos = data?.filter(b => b.ala_group === alaGroup) || [];
      const alaGroups = meterGroups.filter(g => g.ala_group === alaGroup);

      types[alaGroup] = alaRcbos.length > 0 ? 'rcbo' : (alaGroups.length > 0 ? 'groups' : 'groups');

      for (let i = 1; i <= 50; i++) {
        const breaker = alaRcbos.find(b => b.rcbo_number === i);
        formData[alaGroup][i] = {
          tenant_id: breaker?.tenant_id || null,
          assignment_type: breaker?.assignment_type || 'eigen',
          description: breaker?.description || '',
        };
      }
    }

    setRcboFormData(formData);
    setAlaType(types);
    setOriginalAlaType(types);
  };

  const handleSaveWifi = async () => {
    try {
      for (let i = 1; i <= 9; i++) {
        const network = wifiNetworks.find(n => n.network_number === i);
        const formValues = wifiFormData[i];

        const updateData = {
          network_name: formValues.network_name,
          password: formValues.password,
          assignment_type: formValues.assignment_type,
          tenant_id: formValues.assignment_type === 'huurder' ? (formValues.tenant_id || null) : null,
          updated_at: new Date().toISOString(),
        };

        if (network) {
          await supabase
            .from('wifi_networks')
            .update(updateData)
            .eq('id', network.id);
        } else {
          await supabase
            .from('wifi_networks')
            .insert([{
              network_number: i,
              ...updateData,
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

          const hasData = formValues.assignment_type !== 'eigen' || formValues.tenant_id || formValues.notes.trim();

          const updateData = {
            assignment_type: formValues.assignment_type,
            tenant_id: formValues.assignment_type === 'huurder' ? (formValues.tenant_id || null) : null,
            notes: formValues.notes,
            updated_at: new Date().toISOString(),
          };

          if (port) {
            if (hasData) {
              await supabase
                .from('patch_ports')
                .update(updateData)
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
                ...updateData,
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
      const allAlaGroups = Array.from({ length: 10 }, (_, i) => `ALA${i + 1}`);

      for (const alaGroup of allAlaGroups) {
        const type = alaType[alaGroup] || 'groups';
        const originalType = originalAlaType[alaGroup] || 'groups';
        const typeChanged = type !== originalType;

        if (type === 'groups') {
          const entries = meterFormData[alaGroup] || {};

          for (const groupNumber of Object.keys(entries)) {
            const formValues = entries[parseInt(groupNumber)];
            if (!formValues) continue;

            const hasData = formValues.assignment_type !== 'eigen' || formValues.tenant_id || formValues.description.trim();
            const existingGroup = meterGroups.find(g => g.ala_group === alaGroup && g.group_number === parseInt(groupNumber));

            const meterData = {
              ala_group: alaGroup,
              group_number: parseInt(groupNumber),
              assignment_type: formValues.assignment_type,
              tenant_id: formValues.assignment_type === 'huurder' ? (formValues.tenant_id || null) : null,
              description: formValues.description,
            };

            if (existingGroup) {
              if (hasData) {
                await supabase
                  .from('meter_groups')
                  .update({
                    ...meterData,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existingGroup.id);
              } else {
                await supabase
                  .from('meter_groups')
                  .delete()
                  .eq('id', existingGroup.id);
              }
            } else if (hasData) {
              await supabase
                .from('meter_groups')
                .insert([meterData]);
            }
          }

          if (typeChanged) {
            await supabase
              .from('rcbo_circuit_breakers')
              .delete()
              .eq('ala_group', alaGroup);
          }

        } else if (type === 'rcbo') {
          const rcboData = rcboFormData[alaGroup] || {};

          for (let i = 1; i <= 50; i++) {
            const formValues = rcboData[i];
            if (!formValues) continue;

            const hasData = formValues.assignment_type !== 'eigen' || formValues.tenant_id || formValues.description.trim();
            const breaker = rcboBreakers.find(b => b.ala_group === alaGroup && b.rcbo_number === i);

            const rcboUpdateData = {
              assignment_type: formValues.assignment_type,
              tenant_id: formValues.assignment_type === 'huurder' ? (formValues.tenant_id || null) : null,
              description: formValues.description,
            };

            if (breaker) {
              if (hasData) {
                await supabase
                  .from('rcbo_circuit_breakers')
                  .update({
                    ...rcboUpdateData,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', breaker.id);
              } else {
                await supabase
                  .from('rcbo_circuit_breakers')
                  .delete()
                  .eq('id', breaker.id);
              }
            } else if (hasData) {
              await supabase
                .from('rcbo_circuit_breakers')
                .insert([{
                  ala_group: alaGroup,
                  rcbo_number: i,
                  ...rcboUpdateData,
                }]);
            }
          }

          if (typeChanged) {
            await supabase
              .from('meter_groups')
              .delete()
              .eq('ala_group', alaGroup);
          }
        }
      }

      await Promise.all([fetchMeterGroups(), fetchRcboBreakers()]);
      setOriginalAlaType({ ...alaType });
      setEditingSection(null);
    } catch (error) {
      console.error('Error saving meter configuration:', error);
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

  const getTenantColor = (tenantId: string | null) => {
    if (!tenantId) return '#6B7280';
    const tenantIndex = tenants.findIndex(t => t.id === tenantId);
    if (tenantIndex === -1) return '#6B7280';
    return TENANT_COLORS[tenantIndex % TENANT_COLORS.length];
  };

  const getAssignmentColor = (assignmentType: 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek', tenantId: string | null) => {
    if (assignmentType === 'spreekkamer') return SPACE_COLORS.spreekkamer;
    if (assignmentType === 'flexplek') return SPACE_COLORS.flexplek;
    if (assignmentType === 'huurder' && tenantId) return getTenantColor(tenantId);
    return SPACE_COLORS.eigen;
  };

  const getAssignmentLabel = (assignmentType: 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek', tenantId: string | null) => {
    if (assignmentType === 'spreekkamer') return 'Spreekkamer';
    if (assignmentType === 'flexplek') return 'Flexplek';
    if (assignmentType === 'huurder' && tenantId) return getTenantName(tenantId);
    return 'Eigen gebruik';
  };

  const getGlobalKNumber = (alaGroup: string, groupNumber: number): number => {
    const alaNumber = parseInt(alaGroup.replace('ALA', ''));
    const previousALAs = Array.from({ length: alaNumber - 1 }, (_, i) => `ALA${i + 1}`);

    let offset = 0;
    for (const prevAla of previousALAs) {
      const groupsInAla = meterGroups.filter(g => g.ala_group === prevAla);
      if (groupsInAla.length > 0) {
        const maxGroupInAla = Math.max(...groupsInAla.map(g => g.group_number));
        offset += maxGroupInAla;
      }
    }

    return offset + groupNumber;
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
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Kleur Legenda</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border-2 border-dark-700 flex-shrink-0" style={{ backgroundColor: SPACE_COLORS.eigen }} />
              <span className="text-sm text-gray-200">Eigen gebruik</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border-2 border-dark-700 flex-shrink-0" style={{ backgroundColor: SPACE_COLORS.spreekkamer }} />
              <span className="text-sm text-gray-200">Spreekkamer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded border-2 border-dark-700 flex-shrink-0" style={{ backgroundColor: SPACE_COLORS.flexplek }} />
              <span className="text-sm text-gray-200">Flexplek</span>
            </div>
            {tenants.map((tenant, index) => (
              <div key={tenant.id} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border-2 border-dark-700 flex-shrink-0"
                  style={{ backgroundColor: TENANT_COLORS[index % TENANT_COLORS.length] }}
                />
                <span className="text-sm text-gray-200 truncate" title={tenant.company_name}>
                  {tenant.company_name}
                </span>
              </div>
            ))}
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
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                  const formValues = wifiFormData[num] || { network_name: '', password: '', tenant_id: null, assignment_type: 'eigen' as const };
                  const borderColor = getAssignmentColor(formValues.assignment_type, formValues.tenant_id);

                  return (
                    <div
                      key={num}
                      className="bg-dark-800 rounded-lg p-3 border-2"
                      style={{ borderColor }}
                    >
                      <h4 className="text-xs font-semibold text-gray-300 mb-2">Netwerk {num}</h4>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Netwerk Naam</label>
                          <input
                            type="text"
                            value={formValues.network_name}
                            onChange={(e) => setWifiFormData({
                              ...wifiFormData,
                              [num]: { ...formValues, network_name: e.target.value }
                            })}
                            placeholder="Bijv. HAL5-Kantoor"
                            className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Wachtwoord</label>
                          <input
                            type="text"
                            value={formValues.password}
                            onChange={(e) => setWifiFormData({
                              ...wifiFormData,
                              [num]: { ...formValues, password: e.target.value }
                            })}
                            placeholder="Wachtwoord"
                            className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Type</label>
                          <select
                            value={formValues.assignment_type}
                            onChange={(e) => {
                              const newType = e.target.value as 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek';
                              setWifiFormData({
                                ...wifiFormData,
                                [num]: {
                                  ...formValues,
                                  assignment_type: newType,
                                  tenant_id: newType === 'huurder' ? formValues.tenant_id : null
                                }
                              });
                            }}
                            className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                          >
                            <option value="eigen">Eigen gebruik</option>
                            <option value="spreekkamer">Spreekkamer</option>
                            <option value="flexplek">Flexplek</option>
                            <option value="huurder">Huurder</option>
                          </select>
                        </div>
                        {formValues.assignment_type === 'huurder' && (
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Huurder</label>
                            <select
                              value={formValues.tenant_id || ''}
                              onChange={(e) => setWifiFormData({
                                ...wifiFormData,
                                [num]: { ...formValues, tenant_id: e.target.value || null }
                              })}
                              className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                            >
                              <option value="">Selecteer huurder</option>
                              {tenants.map(tenant => (
                                <option key={tenant.id} value={tenant.id}>
                                  {tenant.company_name}
                                </option>
                              ))}
                            </select>
                          </div>
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
                const assignmentType = network?.assignment_type || 'eigen';
                const assignmentLabel = network ? getAssignmentLabel(assignmentType, network.tenant_id) : 'Eigen gebruik';
                const borderColor = network ? getAssignmentColor(assignmentType, network.tenant_id) : SPACE_COLORS.eigen;

                return (
                  <div
                    key={num}
                    className={`bg-dark-800 rounded-lg p-3 border-2 ${hasData ? '' : 'opacity-60'}`}
                    style={{ borderColor: hasData ? borderColor : '#374151' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-gray-400">Netwerk {num}</h4>
                        {hasData && (
                          <div
                            className="w-3 h-3 rounded border border-dark-700 flex-shrink-0"
                            style={{ backgroundColor: borderColor }}
                          />
                        )}
                      </div>
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
                        <div className="flex items-center gap-1 pt-1 border-t border-dark-700">
                          <User size={10} className="text-gray-400 flex-shrink-0" />
                          <p className="text-xs text-gray-300 truncate" title={assignmentLabel}>{assignmentLabel}</p>
                        </div>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((portNum) => {
                      const key = `${switchNum}-${portNum}`;
                      const formValues = patchFormData[key] || { tenant_id: null, assignment_type: 'eigen' as const, notes: '' };
                      const borderColor = getAssignmentColor(formValues.assignment_type, formValues.tenant_id);
                      return (
                        <div
                          key={key}
                          className="bg-dark-900 rounded-lg p-3 border-2"
                          style={{ borderColor }}
                        >
                          <label className="block text-xs font-medium text-gray-400 mb-2">
                            Poort {portNum}
                          </label>
                          <div className="space-y-2">
                            <select
                              value={formValues.assignment_type}
                              onChange={(e) => {
                                const newType = e.target.value as 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek';
                                setPatchFormData({
                                  ...patchFormData,
                                  [key]: {
                                    ...formValues,
                                    assignment_type: newType,
                                    tenant_id: newType === 'huurder' ? formValues.tenant_id : null
                                  }
                                });
                              }}
                              className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500"
                            >
                              <option value="eigen">Eigen gebruik</option>
                              <option value="spreekkamer">Spreekkamer</option>
                              <option value="flexplek">Flexplek</option>
                              <option value="huurder">Huurder</option>
                            </select>

                            {formValues.assignment_type === 'huurder' && (
                              <select
                                value={formValues.tenant_id || ''}
                                onChange={(e) => setPatchFormData({
                                  ...patchFormData,
                                  [key]: { ...formValues, tenant_id: e.target.value || null }
                                })}
                                className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500"
                              >
                                <option value="">Selecteer huurder</option>
                                {tenants.map(tenant => (
                                  <option key={tenant.id} value={tenant.id}>
                                    {tenant.company_name}
                                  </option>
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
                const switchPorts = patchPorts.filter(p => p.switch_number === switchNum);
                const hasAnyData = switchPorts.some(p => p.assignment_type !== 'eigen' || p.tenant_id || p.notes);

                return (
                  <div key={switchNum} className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
                    <div className="px-4 py-3 bg-dark-750 border-b border-dark-600 flex items-center gap-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="w-2 h-2 rounded-full bg-green-500 opacity-60" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-200 tracking-wide">Switch {switchNum}</h4>
                      <span className="text-xs text-gray-500 ml-auto">24 poorten</span>
                    </div>

                    {hasAnyData ? (
                      <div className="p-4 space-y-3">
                        {[0, 1].map((row) => (
                          <div key={row} className="grid grid-cols-12 gap-1.5">
                            {Array.from({ length: 12 }, (_, i) => row * 12 + i + 1).map((portNum) => {
                              const port = patchPorts.find(p => p.switch_number === switchNum && p.port_number === portNum);
                              const assignmentType = port?.assignment_type || 'eigen';
                              const color = port ? getAssignmentColor(assignmentType, port.tenant_id) : SPACE_COLORS.eigen;
                              const label = port ? getAssignmentLabel(assignmentType, port.tenant_id) : 'Eigen gebruik';
                              const hasInfo = port && (port.assignment_type !== 'eigen' || port.tenant_id || port.notes);

                              return (
                                <div key={portNum} className="group relative flex flex-col items-center">
                                  <div
                                    className="w-full h-14 rounded border-2 flex flex-col items-center justify-center cursor-default transition-all group-hover:scale-105 group-hover:z-10 relative overflow-hidden px-1"
                                    style={{
                                      backgroundColor: hasInfo ? color + '22' : '#1f2937',
                                      borderColor: hasInfo ? color : '#374151',
                                    }}
                                  >
                                    <div
                                      className="w-2 h-3.5 rounded-sm mb-1 flex-shrink-0"
                                      style={{ backgroundColor: hasInfo ? color : '#374151' }}
                                    />
                                    <span
                                      className="text-[9px] font-medium leading-tight text-center w-full truncate px-0.5"
                                      style={{ color: hasInfo ? color : '#6B7280' }}
                                    >
                                      {hasInfo ? label : '—'}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-gray-600 mt-0.5 leading-none">{portNum}</span>
                                  {hasInfo && (
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 hidden group-hover:block pointer-events-none">
                                      <div className="bg-dark-900 border border-dark-500 rounded-lg p-2.5 text-left shadow-xl min-w-[150px]">
                                        <p className="text-xs font-semibold text-gray-200 whitespace-nowrap">Poort {portNum}</p>
                                        <p className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">{label}</p>
                                        {port?.notes && <p className="text-xs text-gray-500 mt-0.5 whitespace-nowrap">{port.notes}</p>}
                                        <div className="w-full h-1 rounded mt-2" style={{ backgroundColor: color }} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <p className="text-sm text-gray-500">Geen poorten geconfigureerd</p>
                      </div>
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
              <div className="flex items-center gap-6 pb-4 border-b border-dark-700">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-300">Aardlek:</label>
                  <select
                    value={selectedAla}
                    onChange={(e) => setSelectedAla(e.target.value)}
                    className="bg-dark-800 border border-dark-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                  >
                    {Array.from({ length: 10 }, (_, i) => `ALA${i + 1}`).map(ala => (
                      <option key={ala} value={ala}>Aardlek {ala.replace('ALA', '')}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-300">Type:</label>
                  <select
                    value={alaType[selectedAla] || 'groups'}
                    onChange={(e) => setAlaType({ ...alaType, [selectedAla]: e.target.value as 'groups' | 'rcbo' })}
                    className="bg-dark-800 border border-dark-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                  >
                    <option value="groups">Aardlek met Automaten (Groepen)</option>
                    <option value="rcbo">Aardlekautomaten</option>
                  </select>
                </div>
              </div>

              {alaType[selectedAla] === 'groups' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {Array.from({ length: 50 }, (_, i) => i + 1).map((groupNum) => {
                    const currentAlaData = meterFormData[selectedAla] || {};
                    const formValues = currentAlaData[groupNum] || { group_number: groupNum, tenant_id: null, assignment_type: 'eigen' as const, description: '' };
                    const assignmentType = formValues.assignment_type || 'eigen';
                    const hasData = assignmentType !== 'eigen' || formValues.tenant_id || formValues.description.trim();

                    if (!hasData && groupNum > Math.max(0, ...Object.keys(currentAlaData).filter(k => {
                      const data = currentAlaData[parseInt(k)];
                      return data && (data.assignment_type !== 'eigen' || data.tenant_id || data.description.trim());
                    }).map(k => parseInt(k))) + 5) {
                      return null;
                    }

                    const globalK = getGlobalKNumber(selectedAla, groupNum);
                    const borderColor = getAssignmentColor(assignmentType, formValues.tenant_id);

                    return (
                      <div
                        key={groupNum}
                        className="bg-dark-800 rounded-lg p-3 border-2"
                        style={{ borderColor }}
                      >
                        <label className="block text-xs font-medium text-gray-400 mb-2">
                          Groep K{globalK}
                        </label>
                        <div className="space-y-2">
                          <select
                            value={assignmentType}
                            onChange={(e) => {
                              const newType = e.target.value as 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek';
                              setMeterFormData({
                                ...meterFormData,
                                [selectedAla]: {
                                  ...currentAlaData,
                                  [groupNum]: {
                                    ...formValues,
                                    assignment_type: newType,
                                    tenant_id: newType === 'huurder' ? formValues.tenant_id : null
                                  }
                                }
                              });
                            }}
                            className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500"
                          >
                            <option value="eigen">Eigen gebruik</option>
                            <option value="spreekkamer">Spreekkamer</option>
                            <option value="flexplek">Flexplek</option>
                            <option value="huurder">Huurder</option>
                          </select>

                          {assignmentType === 'huurder' && (
                            <select
                              value={formValues.tenant_id || ''}
                              onChange={(e) => setMeterFormData({
                                ...meterFormData,
                                [selectedAla]: {
                                  ...currentAlaData,
                                  [groupNum]: { ...formValues, tenant_id: e.target.value || null }
                                }
                              })}
                              className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500"
                            >
                              <option value="">Selecteer huurder</option>
                              {tenants.map(tenant => (
                                <option key={tenant.id} value={tenant.id}>
                                  {tenant.company_name}
                                </option>
                              ))}
                            </select>
                          )}

                          <textarea
                            value={formValues.description}
                            onChange={(e) => setMeterFormData({
                              ...meterFormData,
                              [selectedAla]: {
                                ...currentAlaData,
                                [groupNum]: { ...formValues, description: e.target.value }
                              }
                            })}
                            placeholder="Omschrijving (meerdere regels mogelijk)"
                            rows={3}
                            className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500 resize-y"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => {
                    const currentRcboData = rcboFormData[selectedAla] || {};
                    const formValues = currentRcboData[num] || { tenant_id: null, assignment_type: 'eigen' as const, description: '' };
                    const assignmentType = formValues.assignment_type || 'eigen';
                    const hasData = assignmentType !== 'eigen' || formValues.tenant_id || formValues.description.trim();

                    if (!hasData && num > Math.max(0, ...Object.keys(currentRcboData).filter(k => {
                      const data = currentRcboData[parseInt(k)];
                      return data && (data.assignment_type !== 'eigen' || data.tenant_id || data.description.trim());
                    }).map(k => parseInt(k))) + 5) {
                      return null;
                    }

                    const borderColor = getAssignmentColor(assignmentType, formValues.tenant_id);

                    return (
                      <div
                        key={num}
                        className="bg-dark-800 rounded-lg p-3 border-2"
                        style={{ borderColor }}
                      >
                        <label className="block text-xs font-medium text-gray-400 mb-2">
                          Automaat {num}
                        </label>
                        <div className="space-y-2">
                          <select
                            value={assignmentType}
                            onChange={(e) => {
                              const newType = e.target.value as 'eigen' | 'huurder' | 'spreekkamer' | 'flexplek';
                              setRcboFormData({
                                ...rcboFormData,
                                [selectedAla]: {
                                  ...currentRcboData,
                                  [num]: {
                                    ...formValues,
                                    assignment_type: newType,
                                    tenant_id: newType === 'huurder' ? formValues.tenant_id : null
                                  }
                                }
                              });
                            }}
                            className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500"
                          >
                            <option value="eigen">Eigen gebruik</option>
                            <option value="spreekkamer">Spreekkamer</option>
                            <option value="flexplek">Flexplek</option>
                            <option value="huurder">Huurder</option>
                          </select>

                          {assignmentType === 'huurder' && (
                            <select
                              value={formValues.tenant_id || ''}
                              onChange={(e) => setRcboFormData({
                                ...rcboFormData,
                                [selectedAla]: {
                                  ...currentRcboData,
                                  [num]: { ...formValues, tenant_id: e.target.value || null }
                                }
                              })}
                              className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500"
                            >
                              <option value="">Selecteer huurder</option>
                              {tenants.map(tenant => (
                                <option key={tenant.id} value={tenant.id}>
                                  {tenant.company_name}
                                </option>
                              ))}
                            </select>
                          )}

                          <textarea
                            value={formValues.description}
                            onChange={(e) => setRcboFormData({
                              ...rcboFormData,
                              [selectedAla]: {
                                ...currentRcboData,
                                [num]: { ...formValues, description: e.target.value }
                              }
                            })}
                            placeholder="Omschrijving (meerdere regels mogelijk)"
                            rows={3}
                            className="w-full bg-dark-900 border border-dark-600 rounded px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-gold-500 resize-y"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  onClick={() => {
                    setEditingSection(null);
                    setAlaType({ ...originalAlaType });
                    Promise.all([fetchMeterGroups(), fetchRcboBreakers()]);
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
              {meterGroups.length > 0 || rcboBreakers.length > 0 ? (
                <div className="space-y-4">
                  {Array.from({ length: 10 }, (_, i) => `ALA${i + 1}`).map(alaGroup => {
                    const alaGroups = meterGroups.filter(g => g.ala_group === alaGroup);
                    const alaRcbos = rcboBreakers.filter(b => b.ala_group === alaGroup);

                    if (alaGroups.length === 0 && alaRcbos.length === 0) return null;

                    const isRcbo = alaRcbos.length > 0;
                    const alaNum = alaGroup.replace('ALA', '');

                    if (isRcbo) {
                      const sortedRcbos = [...alaRcbos].sort((a, b) => a.rcbo_number - b.rcbo_number);
                      return (
                        <div key={alaGroup} className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
                          <div className="px-4 py-3 bg-dark-750 border-b border-dark-600 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-amber-400" />
                            <h4 className="text-sm font-semibold text-gray-200">Aardlek {alaNum}</h4>
                            <span className="text-xs bg-dark-900 text-gray-400 px-2 py-0.5 rounded-full border border-dark-600">Aardlekautomaten</span>
                            <span className="text-xs text-gray-500 ml-auto">{sortedRcbos.length} automaten</span>
                          </div>
                          <div className="p-4">
                            <div className="flex flex-wrap gap-2">
                              {sortedRcbos.map(breaker => {
                                const assignmentType = breaker.assignment_type || 'eigen';
                                const displayLabel = getAssignmentLabel(assignmentType, breaker.tenant_id);
                                const color = getAssignmentColor(assignmentType, breaker.tenant_id);
                                return (
                                  <div
                                    key={breaker.id}
                                    className="flex-shrink-0 w-[120px] bg-dark-900 rounded-lg border overflow-hidden"
                                    style={{ borderColor: color + '66' }}
                                  >
                                    <div
                                      className="h-1.5 w-full"
                                      style={{ backgroundColor: color }}
                                    />
                                    <div className="p-2.5">
                                      <p className="text-[10px] font-semibold text-gray-500 mb-1">Automaat {breaker.rcbo_number}</p>
                                      <p className="text-xs font-medium text-gray-200 leading-tight truncate" title={displayLabel}>{displayLabel}</p>
                                      {breaker.description && (
                                        <p className="text-[10px] text-gray-400 mt-1 leading-tight line-clamp-2" title={breaker.description}>
                                          {breaker.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      const sortedGroups = [...alaGroups].sort((a, b) => a.group_number - b.group_number);
                      return (
                        <div key={alaGroup} className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
                          <div className="px-4 py-3 bg-dark-750 border-b border-dark-600 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                            <h4 className="text-sm font-semibold text-gray-200">Aardlek {alaNum}</h4>
                            <span className="text-xs bg-dark-900 text-gray-400 px-2 py-0.5 rounded-full border border-dark-600">Groepen</span>
                            <span className="text-xs text-gray-500 ml-auto">{sortedGroups.length} groepen</span>
                          </div>
                          <div className="p-4">
                            <div className="flex flex-wrap gap-2">
                              {sortedGroups.map(group => {
                                const assignmentType = group.assignment_type || 'eigen';
                                const displayLabel = getAssignmentLabel(assignmentType, group.tenant_id);
                                const color = getAssignmentColor(assignmentType, group.tenant_id);
                                const globalK = getGlobalKNumber(alaGroup, group.group_number);
                                return (
                                  <div
                                    key={group.id}
                                    className="flex-shrink-0 w-[120px] bg-dark-900 rounded-lg border overflow-hidden"
                                    style={{ borderColor: color + '66' }}
                                  >
                                    <div
                                      className="h-1.5 w-full"
                                      style={{ backgroundColor: color }}
                                    />
                                    <div className="p-2.5">
                                      <p className="text-[10px] font-semibold text-gray-500 mb-1">K{globalK}</p>
                                      <p className="text-xs font-medium text-gray-200 leading-tight truncate" title={displayLabel || ''}>{displayLabel}</p>
                                      {group.description && (
                                        <p className="text-[10px] text-gray-400 mt-1 leading-tight line-clamp-2" title={group.description}>
                                          {group.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Geen meterkast configuratie beschikbaar</p>
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
