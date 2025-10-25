import { useState, useEffect } from 'react';
import { supabase, type Lease, type Tenant, type OfficeSpace, type LeaseSpace } from '../lib/supabase';
import { Plus, CreditCard as Edit2, Trash2, Calendar, Euro, X } from 'lucide-react';

type LeaseWithDetails = Lease & {
  tenant: Tenant;
  lease_spaces: (LeaseSpace & { space: OfficeSpace })[];
};

export function LeaseManagement() {
  const [leases, setLeases] = useState<LeaseWithDetails[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [spaces, setSpaces] = useState<OfficeSpace[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLease, setEditingLease] = useState<LeaseWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    tenant_id: '',
    start_date: '',
    end_date: '',
    security_deposit: '',
    vat_rate: '21',
    vat_inclusive: false,
    status: 'active' as 'active' | 'expired' | 'terminated'
  });

  const [selectedSpaces, setSelectedSpaces] = useState<Array<{
    space_id: string;
    price_per_sqm: string;
  }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: leasesData } = await supabase
      .from('leases')
      .select(`
        *,
        tenant:tenants(*),
        lease_spaces:lease_spaces(
          *,
          space:office_spaces(*)
        )
      `)
      .order('created_at', { ascending: false });

    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('*')
      .order('name');

    const { data: spacesData } = await supabase
      .from('office_spaces')
      .select('*')
      .order('space_number');

    setLeases(leasesData as LeaseWithDetails[] || []);
    setTenants(tenantsData || []);
    setSpaces(spacesData || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSpaces.length === 0) {
      console.error('Selecteer minimaal één kantoorruimte');
      return;
    }

    const leaseData = {
      tenant_id: formData.tenant_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      security_deposit: parseFloat(formData.security_deposit),
      vat_rate: parseFloat(formData.vat_rate),
      vat_inclusive: formData.vat_inclusive,
      status: formData.status
    };

    if (editingLease) {
      const { error } = await supabase
        .from('leases')
        .update(leaseData)
        .eq('id', editingLease.id);

      if (error) {
        console.error('Error updating lease:', error);
        return;
      }

      await supabase
        .from('lease_spaces')
        .delete()
        .eq('lease_id', editingLease.id);

      const leaseSpacesData = selectedSpaces.map(space => {
        const officeSpace = spaces.find(s => s.id === space.space_id);
        const monthlyRent = officeSpace ? (officeSpace.square_footage * parseFloat(space.price_per_sqm)) / 12 : 0;
        return {
          lease_id: editingLease.id,
          space_id: space.space_id,
          price_per_sqm: parseFloat(space.price_per_sqm),
          monthly_rent: monthlyRent
        };
      });

      const { error: spaceError } = await supabase
        .from('lease_spaces')
        .insert(leaseSpacesData);

      if (spaceError) {
        console.error('Error updating lease spaces:', spaceError);
        return;
      }

      const spaceIds = selectedSpaces.map(s => s.space_id);
      await supabase
        .from('office_spaces')
        .update({ is_available: false })
        .in('id', spaceIds);

    } else {
      const { data: newLease, error } = await supabase
        .from('leases')
        .insert([leaseData])
        .select()
        .single();

      if (error) {
        console.error('Error creating lease:', error);
        return;
      }

      const leaseSpacesData = selectedSpaces.map(space => {
        const officeSpace = spaces.find(s => s.id === space.space_id);
        const monthlyRent = officeSpace ? (officeSpace.square_footage * parseFloat(space.price_per_sqm)) / 12 : 0;
        return {
          lease_id: newLease.id,
          space_id: space.space_id,
          price_per_sqm: parseFloat(space.price_per_sqm),
          monthly_rent: monthlyRent
        };
      });

      const { error: spaceError } = await supabase
        .from('lease_spaces')
        .insert(leaseSpacesData);

      if (spaceError) {
        console.error('Error creating lease spaces:', spaceError);
        return;
      }

      const spaceIds = selectedSpaces.map(s => s.space_id);
      await supabase
        .from('office_spaces')
        .update({ is_available: false })
        .in('id', spaceIds);
    }

    resetForm();
    loadData();
  };

  const handleEdit = (lease: LeaseWithDetails) => {
    setEditingLease(lease);
    setFormData({
      tenant_id: lease.tenant_id,
      start_date: lease.start_date,
      end_date: lease.end_date,
      security_deposit: lease.security_deposit.toString(),
      vat_rate: lease.vat_rate.toString(),
      vat_inclusive: lease.vat_inclusive,
      status: lease.status
    });
    setSelectedSpaces(lease.lease_spaces.map(ls => ({
      space_id: ls.space_id,
      price_per_sqm: ls.price_per_sqm.toString()
    })));
    setShowForm(true);
  };

  const handleDelete = async (lease: LeaseWithDetails) => {
    const spaceIds = lease.lease_spaces.map(ls => ls.space_id);

    const { error } = await supabase
      .from('leases')
      .delete()
      .eq('id', lease.id);

    if (error) {
      console.error('Error deleting lease:', error);
    } else {
      await supabase
        .from('office_spaces')
        .update({ is_available: true })
        .in('id', spaceIds);
      loadData();
    }
  };

  const addSpace = () => {
    setSelectedSpaces([...selectedSpaces, { space_id: '', price_per_sqm: '' }]);
  };

  const removeSpace = (index: number) => {
    setSelectedSpaces(selectedSpaces.filter((_, i) => i !== index));
  };

  const updateSpace = (index: number, field: 'space_id' | 'price_per_sqm', value: string) => {
    const updated = [...selectedSpaces];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedSpaces(updated);
  };

  const getAvailableSpaces = (currentIndex: number) => {
    const selectedIds = selectedSpaces
      .map((s, i) => i !== currentIndex ? s.space_id : null)
      .filter(id => id !== null);

    const occupiedSpaceIds = leases
      .filter(l => !editingLease || l.id !== editingLease.id)
      .flatMap(l => l.lease_spaces.map(ls => ls.space_id));

    return spaces.filter(s =>
      !selectedIds.includes(s.id) &&
      !occupiedSpaceIds.includes(s.id)
    );
  };

  const calculateSpaceRent = (spaceId: string, pricePerSqm: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space || !pricePerSqm) return 0;
    const yearlyRent = space.square_footage * parseFloat(pricePerSqm);
    return yearlyRent / 12;
  };

  const getTotalMonthlyRent = () => {
    const spacesTotal = selectedSpaces.reduce((sum, space) => {
      return sum + calculateSpaceRent(space.space_id, space.price_per_sqm);
    }, 0);
    const securityDeposit = parseFloat(formData.security_deposit) || 0;
    return spacesTotal + securityDeposit;
  };

  const resetForm = () => {
    setFormData({
      tenant_id: '',
      start_date: '',
      end_date: '',
      security_deposit: '',
      vat_rate: '21',
      vat_inclusive: false,
      status: 'active'
    });
    setSelectedSpaces([]);
    setEditingLease(null);
    setShowForm(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-green-900 text-green-400 text-xs rounded-full font-medium">Actief</span>;
      case 'expired':
        return <span className="px-2 py-1 bg-red-900 text-red-400 text-xs rounded-full font-medium">Verlopen</span>;
      case 'terminated':
        return <span className="px-2 py-1 bg-dark-700 text-gray-400 text-xs rounded-full font-medium">Beëindigd</span>;
      default:
        return null;
    }
  };

  const calculateLeaseTotal = (lease: LeaseWithDetails) => {
    return lease.lease_spaces.reduce((sum, ls) => sum + ls.monthly_rent, 0);
  };

  if (loading) {
    return <div className="text-center py-8">Huurcontracten laden...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100">Huurcontracten</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
          disabled={tenants.length === 0 || spaces.length === 0}
        >
          <Plus size={20} />
          Huurcontract Aanmaken
        </button>
      </div>

      {(tenants.length === 0 || spaces.length === 0) && (
        <div className="bg-dark-700 border border-amber-700 rounded-lg p-4 mb-6">
          <p className="text-amber-400">
            {tenants.length === 0 && 'Voeg eerst huurders toe voordat je huurcontracten aanmaakt. '}
            {spaces.length === 0 && 'Voeg eerst kantoorruimtes toe voordat je huurcontracten aanmaakt.'}
          </p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-3xl my-8 mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {editingLease ? 'Huurcontract Bewerken' : 'Nieuw Huurcontract Aanmaken'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Huurder
                </label>
                <select
                  required
                  value={formData.tenant_id}
                  onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  disabled={!!editingLease}
                >
                  <option value="">Selecteer een huurder...</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-200">
                    Kantoorruimtes
                  </label>
                  <button
                    type="button"
                    onClick={addSpace}
                    className="text-sm text-gold-500 hover:text-gold-400"
                  >
                    + Ruimte Toevoegen
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedSpaces.map((space, index) => {
                    const availableSpaces = getAvailableSpaces(index);
                    const selectedSpace = spaces.find(s => s.id === space.space_id);
                    const monthlyRent = calculateSpaceRent(space.space_id, space.price_per_sqm);

                    return (
                      <div key={index} className="flex gap-2 items-start p-3 bg-dark-950 rounded-lg">
                        <div className="flex-1 space-y-2">
                          <select
                            required
                            value={space.space_id}
                            onChange={(e) => updateSpace(index, 'space_id', e.target.value)}
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                          >
                            <option value="">Selecteer een ruimte...</option>
                            {space.space_id && selectedSpace && (
                              <option value={space.space_id}>
                                {selectedSpace.space_number} - {selectedSpace.space_type === 'kantoor' ? 'Kantoor' : selectedSpace.space_type === 'buitenterrein' ? 'Buitenterrein' : 'Hal'} ({selectedSpace.square_footage} m²)
                              </option>
                            )}
                            {availableSpaces.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.space_number} - {s.space_type === 'kantoor' ? 'Kantoor' : s.space_type === 'buitenterrein' ? 'Buitenterrein' : 'Hal'} ({s.square_footage} m²)
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2 items-center">
                            <div className="flex-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                required
                                placeholder="Prijs per m²"
                                value={space.price_per_sqm}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                    updateSpace(index, 'price_per_sqm', value);
                                  }
                                }}
                                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                              />
                            </div>
                            {selectedSpace && space.price_per_sqm && (
                              <div className="text-sm text-gray-300 whitespace-nowrap">
                                ({selectedSpace.square_footage} m² × €{parseFloat(space.price_per_sqm).toFixed(2)} / 12) = €{monthlyRent.toFixed(2)}/mnd
                              </div>
                            )}
                          </div>
                        </div>
                        {selectedSpaces.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSpace(index)}
                            className="text-red-600 hover:text-red-800 p-2"
                          >
                            <X size={20} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {selectedSpaces.length === 0 && (
                    <div className="text-center py-4 text-gray-400 bg-dark-950 rounded-lg">
                      Click "Add Space" to add office spaces to this lease
                    </div>
                  )}
                  {selectedSpaces.length > 0 && (
                    <div className="text-right pt-2 border-t border-dark-700">
                      <span className="text-sm font-medium text-gray-200">
                        Totale Maandhuur: €{getTotalMonthlyRent().toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Startdatum
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Einddatum
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Voorschot Gas, Water & Electra
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={formData.security_deposit}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setFormData({ ...formData, security_deposit: value });
                      }
                    }}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    BTW-tarief (%)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={formData.vat_rate}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        const numValue = parseFloat(value);
                        if (value === '' || (numValue >= 0 && numValue <= 100)) {
                          setFormData({ ...formData, vat_rate: value });
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="vat_inclusive"
                  checked={formData.vat_inclusive}
                  onChange={(e) => setFormData({ ...formData, vat_inclusive: e.target.checked })}
                  className="w-4 h-4 text-gold-500 border-dark-600 rounded focus:ring-2 focus:ring-gold-500"
                />
                <label htmlFor="vat_inclusive" className="text-sm font-medium text-gray-200">
                  BTW Inclusief (prijzen zijn inclusief BTW)
                </label>
              </div>

              {editingLease && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  >
                    <option value="active">Actief</option>
                    <option value="expired">Verlopen</option>
                    <option value="terminated">Beëindigd</option>
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  {editingLease ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-dark-800 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {leases.map((lease) => {
          const totalRent = calculateLeaseTotal(lease);
          return (
            <div
              key={lease.id}
              className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-100">{lease.tenant.company_name}</h3>
                    {getStatusBadge(lease.status)}
                  </div>
                  <div className="space-y-2 mb-3">
                    {lease.lease_spaces.map((ls) => (
                      <div key={ls.id} className="flex items-center gap-4 text-sm text-gray-300 bg-dark-950 px-3 py-2 rounded">
                        <span className="font-medium">{ls.space.space_number}</span>
                        <span>{ls.space.square_footage} m²</span>
                        <span>×</span>
                        <span>€{ls.price_per_sqm}/m²</span>
                        <span>/12</span>
                        <span>=</span>
                        <span className="font-medium text-gray-100 ml-auto text-right">€{ls.monthly_rent.toFixed(2)}/mnd</span>
                      </div>
                    ))}
                    {lease.security_deposit > 0 && (
                      <div className="flex items-center gap-4 text-sm text-gray-300 bg-dark-800 px-3 py-2 rounded border border-dark-600">
                        <span className="font-medium">Voorschot Gas, Water en Electra</span>
                        <span className="flex-1"></span>
                        <span className="font-medium text-gray-100 text-right">€{lease.security_deposit.toFixed(2)}/mnd</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-300 mb-1">Totale Maandhuur</p>
                      <p className="font-medium text-gray-100">
                        €{(totalRent + lease.security_deposit).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-300 mb-1">BTW</p>
                      <p className="font-medium text-gray-100">
                        {lease.vat_inclusive ? 'Inclusief' : 'Exclusief'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-300 mb-1">Huurperiode</p>
                      <p className="font-medium text-gray-100 flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(lease.start_date).toLocaleDateString()} - {new Date(lease.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(lease)}
                    className="text-gold-500 hover:text-gold-400 transition-colors p-2 hover:bg-dark-800 rounded-lg"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(lease)}
                    className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-900 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {leases.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Nog geen huurcontracten. Klik op "Huurcontract Aanmaken" om je eerste contract aan te maken.
        </div>
      )}
    </div>
  );
}
