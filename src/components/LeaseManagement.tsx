import { useState, useEffect, useMemo } from 'react';
import { supabase, type Lease, type Tenant, type OfficeSpace, type LeaseSpace, type SpaceTypeRate, type CompanySettings } from '../lib/supabase';
import { Plus, CreditCard as Edit2, Trash2, Calendar, Euro, X, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import { LeaseContractPreview } from './LeaseContractPreview';
import type { LeaseContractData } from '../utils/leaseContractPdf';
import { SkeletonTable } from './SkeletonLoader';
import { Pagination } from './Pagination';

type LeaseWithDetails = Lease & {
  tenant: Tenant;
  lease_spaces: (LeaseSpace & { space: OfficeSpace })[];
};

export function LeaseManagement() {
  const [leases, setLeases] = useState<LeaseWithDetails[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [spaces, setSpaces] = useState<OfficeSpace[]>([]);
  const [spaceTypeRates, setSpaceTypeRates] = useState<SpaceTypeRate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLease, setEditingLease] = useState<LeaseWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active');

  const [formData, setFormData] = useState({
    tenant_id: '',
    start_date: '',
    end_date: '',
    security_deposit: '',
    vat_rate: '21',
    vat_inclusive: false,
    status: 'active' as 'active' | 'expired' | 'terminated',
  });

  const [selectedSpaces, setSelectedSpaces] = useState<Array<{
    space_id: string;
    price_per_sqm: string;
  }>>([]);

  const [previewLease, setPreviewLease] = useState<LeaseWithDetails | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  const [regularPage, setRegularPage] = useState(1);
  const [regularPageSize, setRegularPageSize] = useState(10);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showForm && !editingLease && selectedSpaces.length === 0) {
      setSelectedSpaces([{ space_id: '', price_per_sqm: '' }]);
    }
  }, [showForm, editingLease]);

  const loadData = async () => {
    setLoading(true);

    const [
      { data: leasesData },
      { data: tenantsData },
      { data: spacesData },
      { data: ratesData },
      { data: settingsData },
    ] = await Promise.all([
      supabase
        .from('leases')
        .select(`
          *,
          tenant:tenants(*),
          lease_spaces:lease_spaces(
            *,
            space:office_spaces(*)
          )
        `)
        .order('created_at', { ascending: false }),
      supabase.from('tenants').select('*').order('company_name', { ascending: true, nullsFirst: false }).order('name'),
      supabase.from('office_spaces').select('*').order('space_number'),
      supabase.from('space_type_rates').select('*'),
      supabase.from('company_settings').select('*').maybeSingle(),
    ]);

    const sortedLeases = ((leasesData as LeaseWithDetails[]) || []).slice().sort((a, b) => {
      const an = (a.tenant?.company_name || a.tenant?.name || '').toLowerCase();
      const bn = (b.tenant?.company_name || b.tenant?.name || '').toLowerCase();
      return an.localeCompare(bn, 'nl');
    });
    setLeases(sortedLeases);
    setTenants(tenantsData || []);
    setSpaces(spacesData || []);
    setSpaceTypeRates(ratesData || []);
    if (settingsData) setCompanySettings(settingsData as CompanySettings);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSpaces.length === 0) {
      alert('Selecteer minimaal één ruimte');
      return;
    }

    const leaseData: any = {
      tenant_id: formData.tenant_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      security_deposit: parseFloat(formData.security_deposit),
      vat_rate: parseFloat(formData.vat_rate),
      vat_inclusive: formData.vat_inclusive,
      status: formData.status,
      lease_type: 'full_time'
    };

    if (editingLease) {
      const { error } = await supabase
        .from('leases')
        .update(leaseData)
        .eq('id', editingLease.id);

      if (error) {
        console.error('Error updating lease:', error);
        alert('Fout bij het bijwerken van het huurcontract: ' + error.message);
        return;
      }

      await supabase
        .from('lease_spaces')
        .delete()
        .eq('lease_id', editingLease.id);

      {
        const leaseSpacesData = selectedSpaces.map(space => {
          const officeSpace = spaces.find(s => s.id === space.space_id);
          let monthlyRent = 0;
          let effectivePrice = space.price_per_sqm || getDefaultRate(space.space_id);

          if (officeSpace) {
            if (officeSpace.space_type === 'diversen') {
              monthlyRent = calculateDiversenMonthlyRent(officeSpace);
              effectivePrice = monthlyRent.toString();
            } else if (effectivePrice) {
              const yearlyRent = (officeSpace.square_footage || 0) * parseFloat(effectivePrice);
              const isAnnualRate = officeSpace.space_type === 'bedrijfsruimte' || officeSpace.space_type === 'buitenterrein';
              monthlyRent = isAnnualRate ? yearlyRent / 12 : yearlyRent;
            }
          }
          return {
            lease_id: editingLease.id,
            space_id: space.space_id,
            price_per_sqm: parseFloat(effectivePrice) || 0,
            monthly_rent: monthlyRent
          };
        });

        const { error: spaceError } = await supabase
          .from('lease_spaces')
          .insert(leaseSpacesData);

        if (spaceError) {
          console.error('Error updating lease spaces:', spaceError);
          alert('Fout bij het bijwerken van ruimtes: ' + spaceError.message);
          return;
        }

        const nonSharedSpaceIds = selectedSpaces
          .filter(s => {
            const space = spaces.find(sp => sp.id === s.space_id);
            return !space || !(space as any).is_shared || space.space_type !== 'diversen';
          })
          .map(s => s.space_id);

        if (nonSharedSpaceIds.length > 0) {
          await supabase
            .from('office_spaces')
            .update({ is_available: false })
            .in('id', nonSharedSpaceIds);
        }

        for (const selectedSpace of selectedSpaces) {
          const space = spaces.find(sp => sp.id === selectedSpace.space_id);
          if (space && (space as any).is_shared && space.space_type === 'diversen') {
            const leaseCount = leases
              .filter(l => l.id !== editingLease?.id)
              .filter(l => l.lease_spaces.some(ls => ls.space_id === space.id))
              .length + 1;
            const sharedCapacity = (space as any).shared_capacity || 1;
            if (leaseCount >= sharedCapacity) {
              await supabase
                .from('office_spaces')
                .update({ is_available: false })
                .eq('id', space.id);
            }
          }
        }
      }

      resetForm();
      loadData();

    } else {
      const { data: newLease, error } = await supabase
        .from('leases')
        .insert([leaseData])
        .select()
        .single();

      if (error) {
        console.error('Error creating lease:', error);
        alert('Fout bij het aanmaken van het huurcontract: ' + error.message);
        return;
      }

      {
        const leaseSpacesData = selectedSpaces.map(space => {
          const officeSpace = spaces.find(s => s.id === space.space_id);
          let monthlyRent = 0;
          let effectivePrice = space.price_per_sqm || getDefaultRate(space.space_id);

          if (officeSpace) {
            if (officeSpace.space_type === 'diversen') {
              monthlyRent = calculateDiversenMonthlyRent(officeSpace);
              effectivePrice = monthlyRent.toString();
            } else if (effectivePrice) {
              const yearlyRent = (officeSpace.square_footage || 0) * parseFloat(effectivePrice);
              const isAnnualRate = officeSpace.space_type === 'bedrijfsruimte' || officeSpace.space_type === 'buitenterrein';
              monthlyRent = isAnnualRate ? yearlyRent / 12 : yearlyRent;
            }
          }
          return {
            lease_id: newLease.id,
            space_id: space.space_id,
            price_per_sqm: parseFloat(effectivePrice) || 0,
            monthly_rent: monthlyRent
          };
        });

        const { error: spaceError } = await supabase
          .from('lease_spaces')
          .insert(leaseSpacesData);

        if (spaceError) {
          console.error('Error creating lease spaces:', spaceError);
          alert('Fout bij het aanmaken van ruimtes: ' + spaceError.message);
          return;
        }

        const nonSharedSpaceIds = selectedSpaces
          .filter(s => {
            const space = spaces.find(sp => sp.id === s.space_id);
            return !space || !(space as any).is_shared || space.space_type !== 'diversen';
          })
          .map(s => s.space_id);

        if (nonSharedSpaceIds.length > 0) {
          await supabase
            .from('office_spaces')
            .update({ is_available: false })
            .in('id', nonSharedSpaceIds);
        }

        for (const selectedSpace of selectedSpaces) {
          const space = spaces.find(sp => sp.id === selectedSpace.space_id);
          if (space && (space as any).is_shared && space.space_type === 'diversen') {
            const leaseCount = leases.filter(l => l.lease_spaces.some(ls => ls.space_id === space.id)).length + 1;
            const sharedCapacity = (space as any).shared_capacity || 1;
            if (leaseCount >= sharedCapacity) {
              await supabase
                .from('office_spaces')
                .update({ is_available: false })
                .eq('id', space.id);
            }
          }
        }
      }

      resetForm();
      loadData();
    }
  };

  const handleEdit = async (lease: LeaseWithDetails) => {
    setEditingLease(lease);

    setFormData({
      tenant_id: lease.tenant_id,
      start_date: lease.start_date,
      end_date: lease.end_date,
      security_deposit: lease.security_deposit.toString(),
      vat_rate: lease.vat_rate.toString(),
      vat_inclusive: lease.vat_inclusive,
      status: lease.status,
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
      return;
    }

    for (const spaceId of spaceIds) {
      const space = spaces.find(s => s.id === spaceId);
      if (space && (space as any).is_shared && space.space_type === 'diversen') {
        const remainingLeaseCount = leases
          .filter(l => l.id !== lease.id)
          .filter(l => l.lease_spaces.some(ls => ls.space_id === spaceId))
          .length;
        const sharedCapacity = (space as any).shared_capacity || 1;
        if (remainingLeaseCount < sharedCapacity) {
          await supabase
            .from('office_spaces')
            .update({ is_available: true })
            .eq('id', spaceId);
        }
      } else {
        await supabase
          .from('office_spaces')
          .update({ is_available: true })
          .eq('id', spaceId);
      }
    }

    setLeases(leases.filter(l => l.id !== lease.id));
  };

  const addSpace = () => {
    setSelectedSpaces([...selectedSpaces, { space_id: '', price_per_sqm: '' }]);
  };

  const removeSpace = (index: number) => {
    setSelectedSpaces(selectedSpaces.filter((_, i) => i !== index));
  };

  const getDefaultRate = (spaceId: string): string => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return '';

    if (space.space_type === 'diversen' && (!space.diversen_calculation || space.diversen_calculation === 'fixed')) {
      return space.square_footage ? space.square_footage.toFixed(2) : '';
    }

    if (space.rate_per_sqm) {
      return space.rate_per_sqm.toFixed(2);
    }

    return '';
  };

  const calculateDiversenMonthlyRent = (space: OfficeSpace): number => {
    const diversenCalc = (space as any).diversen_calculation;
    if (diversenCalc === 'fixed') {
      return space.square_footage || 0;
    } else if (diversenCalc === 'per_sqm') {
      return (space.square_footage || 0) * (space.rate_per_sqm || 0);
    } else if (diversenCalc === 'quantity_price') {
      const quantity = (space as any).diversen_quantity || 0;
      const unitPrice = (space as any).diversen_unit_price || 0;
      return quantity * unitPrice;
    }
    return 0;
  };

  const updateSpace = (index: number, spaceId: string) => {
    const updated = [...selectedSpaces];
    const defaultRate = getDefaultRate(spaceId);
    updated[index] = {
      space_id: spaceId,
      price_per_sqm: defaultRate
    };
    setSelectedSpaces(updated);
  };

  const getAvailableSpaces = (currentIndex: number) => {
    const selectedIds = selectedSpaces
      .map((s, i) => i !== currentIndex ? s.space_id : null)
      .filter(id => id !== null);

    const leaseSpaceCounts = new Map<string, number>();
    leases
      .filter(l => !editingLease || l.id !== editingLease.id)
      .forEach(l => {
        l.lease_spaces.forEach(ls => {
          leaseSpaceCounts.set(ls.space_id, (leaseSpaceCounts.get(ls.space_id) || 0) + 1);
        });
      });

    return spaces.filter(s => {
      if (selectedIds.includes(s.id)) return false;

      const currentLeaseCount = leaseSpaceCounts.get(s.id) || 0;
      const isShared = (s as any).is_shared;
      const sharedCapacity = (s as any).shared_capacity || 1;

      if (isShared && s.space_type === 'diversen') {
        return currentLeaseCount < sharedCapacity;
      }

      return currentLeaseCount === 0;
    });
  };

  const calculateSpaceRent = (spaceId: string, pricePerSqm: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return 0;

    if (space.space_type === 'diversen') {
      return calculateDiversenMonthlyRent(space);
    }

    const effectivePrice = pricePerSqm || getDefaultRate(spaceId);
    if (!effectivePrice) return 0;

    const yearlyRent = (space.square_footage || 0) * parseFloat(effectivePrice);
    return space.space_type === 'bedrijfsruimte' || space.space_type === 'buitenterrein' ? yearlyRent / 12 : yearlyRent;
  };

  const getTotalMonthlyRent = () => {
    const spacesTotal = selectedSpaces.reduce((sum, space) => {
      return sum + calculateSpaceRent(space.space_id, space.price_per_sqm);
    }, 0);

    const securityDeposit = parseFloat(formData.security_deposit) || 0;
    return spacesTotal + securityDeposit;
  };

  const buildLeaseContractData = (lease: LeaseWithDetails): LeaseContractData => {
    const company = companySettings
      ? {
          name: companySettings.company_name,
          address: companySettings.address,
          postal_code: companySettings.postal_code,
          city: companySettings.city,
          kvk: companySettings.kvk_number,
          btw: companySettings.vat_number,
          iban: companySettings.bank_account,
          email: companySettings.email || undefined,
          phone: companySettings.phone || undefined,
          website: undefined,
        }
      : undefined;

    const contractData: LeaseContractData = {
      tenant_name: lease.tenant.name,
      tenant_company_name: lease.tenant.company_name,
      tenant_street: lease.tenant.street || undefined,
      tenant_postal_code: lease.tenant.postal_code || undefined,
      tenant_city: lease.tenant.city || undefined,
      tenant_country: lease.tenant.country || undefined,
      tenant_email: lease.tenant.email || undefined,
      tenant_phone: lease.tenant.phone || undefined,
      lease_type: 'full_time',
      start_date: lease.start_date,
      end_date: lease.end_date,
      vat_rate: lease.vat_rate,
      vat_inclusive: lease.vat_inclusive,
      security_deposit: lease.security_deposit,
      spaces: lease.lease_spaces.map((ls) => ({
        space_number: ls.space.space_number,
        space_type: ls.space.space_type,
        square_footage: ls.space.square_footage,
        price_per_sqm: ls.price_per_sqm,
        monthly_rent: ls.monthly_rent,
      })),
      company,
    };

    return contractData;
  };

  const resetForm = () => {
    setFormData({
      tenant_id: '',
      start_date: '',
      end_date: '',
      security_deposit: '',
      vat_rate: '21',
      vat_inclusive: false,
      status: 'active',
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

  const { activeLeases, expiredLeases, regularLeases } = useMemo(() => {
    const active = leases.filter(l => l.status === 'active');
    const expired = leases.filter(l => l.status === 'expired' || l.status === 'terminated');
    const current = activeTab === 'active' ? active : expired;
    return {
      activeLeases: active,
      expiredLeases: expired,
      regularLeases: current,
    };
  }, [leases, activeTab]);

  if (loading) {
    return <SkeletonTable />;
  }

  return (
    <div className="h-full bg-dark-950 overflow-y-auto p-6">
      <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('active'); setRegularPage(1); }}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-gold-500 text-white'
                : 'text-gray-300 hover:bg-dark-800'
            }`}
          >
            <CheckCircle size={18} />
            Actief ({activeLeases.length})
          </button>
          <button
            onClick={() => { setActiveTab('expired'); setRegularPage(1); }}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'expired'
                ? 'bg-gold-500 text-white'
                : 'text-gray-300 hover:bg-dark-800'
            }`}
          >
            <XCircle size={18} />
            Verlopen/Beëindigd ({expiredLeases.length})
          </button>
        </div>
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
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-3xl my-8 mx-4 max-h-[90vh] overflow-y-auto border border-dark-700">
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
                    Ruimtes
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
                            onChange={(e) => updateSpace(index, e.target.value)}
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                          >
                            <option value="">Selecteer een ruimte...</option>
                            {space.space_id && selectedSpace && (
                              <option value={space.space_id}>
                                {selectedSpace.space_number} - {selectedSpace.space_type === 'kantoor' ? 'Kantoor' : selectedSpace.space_type === 'buitenterrein' ? 'Buitenterrein' : selectedSpace.space_type === 'bedrijfsruimte' ? 'Bedrijfsruimte' : selectedSpace.space_type === 'meeting_room' ? 'Vergaderruimte' : 'Overig'}{(selectedSpace.space_type === 'diversen' && (!selectedSpace.diversen_calculation || selectedSpace.diversen_calculation === 'fixed')) ? '' : (selectedSpace.square_footage && selectedSpace.square_footage > 0 ? ` (${selectedSpace.square_footage} m²)` : '')}
                              </option>
                            )}
                            {availableSpaces.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.space_number} - {s.space_type === 'kantoor' ? 'Kantoor' : s.space_type === 'buitenterrein' ? 'Buitenterrein' : s.space_type === 'bedrijfsruimte' ? 'Bedrijfsruimte' : s.space_type === 'meeting_room' ? 'Vergaderruimte' : 'Overig'}{(s.space_type === 'diversen' && (!s.diversen_calculation || s.diversen_calculation === 'fixed')) ? '' : (s.square_footage && s.square_footage > 0 ? ` (${s.square_footage} m²)` : '')}
                              </option>
                            ))}
                          </select>
                          {space.space_id && selectedSpace && (
                            <div className="flex gap-2 items-center bg-dark-950 p-3 rounded-lg">
                              <div className="flex-1">
                                <div className="text-sm text-gray-400 mb-1">
                                  {(selectedSpace.space_type === 'diversen' && (!selectedSpace.diversen_calculation || selectedSpace.diversen_calculation === 'fixed')) ? 'Tarief' : (selectedSpace.square_footage && selectedSpace.square_footage > 0 ? 'Tarief per m²' : 'Tarief')}
                                </div>
                                <div className="text-lg font-bold text-gold-500">
                                  €{(() => {
                                    const effectivePrice = space.price_per_sqm || getDefaultRate(space.space_id);
                                    return effectivePrice ? parseFloat(effectivePrice).toFixed(2) : '0.00';
                                  })()}{(selectedSpace.space_type === 'diversen' && (!selectedSpace.diversen_calculation || selectedSpace.diversen_calculation === 'fixed')) ? '' : (selectedSpace.square_footage && selectedSpace.square_footage > 0 ? '/m²' : '')}
                                </div>
                                {space.space_id && getDefaultRate(space.space_id) && (
                                  <div className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
                                    <CheckCircle size={12} />
                                    Tarief van deze ruimte
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-gray-400 mb-1">Maandelijkse huur</div>
                                <div className="text-lg font-bold text-gray-100">
                                  {(() => {
                                    const effectivePrice = space.price_per_sqm || getDefaultRate(space.space_id);
                                    if (!effectivePrice) return '€0.00/mnd';
                                    return selectedSpace.space_type === 'bedrijfsruimte'
                                      ? `€${monthlyRent.toFixed(2)}/mnd`
                                      : `€${monthlyRent.toFixed(2)}/mnd`;
                                  })()}
                                </div>
                                {(selectedSpace.space_type === 'diversen' && (!selectedSpace.diversen_calculation || selectedSpace.diversen_calculation === 'fixed')) ? (
                                  <div className="text-xs text-gray-500 mt-1">Vast bedrag</div>
                                ) : (selectedSpace.square_footage && selectedSpace.square_footage > 0 ? (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {selectedSpace.space_type === 'bedrijfsruimte' || selectedSpace.space_type === 'buitenterrein'
                                      ? `${selectedSpace.square_footage} m² × tarief / 12`
                                      : `${selectedSpace.square_footage} m² × tarief`
                                    }
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500 mt-1">Vast bedrag</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {space.space_id && !selectedSpace && (
                            <div className="text-sm text-amber-500">Selecteer een ruimte om het tarief te zien</div>
                          )}
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
                      Click "+ Ruimte Toevoegen" om kantoorruimtes toe te voegen
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

      <div className="space-y-6">
        {regularLeases.length > 0 && (
          <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-4 py-3 bg-dark-800 border-b border-amber-500">
              <h2 className="text-lg font-bold text-gray-100">
                Huurcontracten
              </h2>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                disabled={tenants.length === 0 || spaces.length === 0}
              >
                <Plus size={20} />
                Huurcontract Aanmaken
              </button>
            </div>
            <div className="overflow-x-auto flex-1 min-h-0">
              <table className="w-full table-fixed min-w-[1000px]">
                <thead>
                  <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                    <th className="text-left px-4 py-3 font-semibold w-[15%]">Huurder</th>
                    <th className="text-left px-4 py-3 font-semibold w-[20%]">Ruimtes</th>
                    <th className="text-right px-4 py-3 font-semibold w-[12%]">Maandhuur</th>
                    <th className="text-left px-4 py-3 font-semibold w-[10%]">BTW</th>
                    <th className="text-left px-4 py-3 font-semibold w-[18%]">Periode</th>
                    <th className="text-center px-4 py-3 font-semibold w-[12%]">Status</th>
                    <th className="text-right px-4 py-3 font-semibold w-[13%]">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {regularLeases.slice((regularPage - 1) * regularPageSize, regularPage * regularPageSize).map((lease) => {
                    const totalRent = calculateLeaseTotal(lease);
                    return (
                      <tr
                        key={lease.id}
                        className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-100 font-medium">{lease.tenant.company_name}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {lease.lease_spaces.map((ls) => (
                              <div key={ls.id} className="text-xs text-gray-300 flex items-center gap-2">
                                <span className="font-medium">{ls.space.space_number}</span>
                                <span className="text-gray-400">({ls.space.square_footage} m² × €{ls.price_per_sqm}/m²)</span>
                              </div>
                            ))}
                            {lease.security_deposit > 0 && (
                              <div className="text-xs text-green-400">
                                + Voorschot G/W/E
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-gray-100 font-medium">
                            €{(totalRent + lease.security_deposit).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-gray-400">
                            (€{totalRent.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {lease.security_deposit > 0 && ` + €${lease.security_deposit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`})
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {lease.vat_inclusive ? 'Inclusief' : 'Exclusief'} ({lease.vat_rate}%)
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} className="text-gold-500" />
                            <div>
                              <div>{new Date(lease.start_date).toLocaleDateString('nl-NL')}</div>
                              <div className="text-gray-400">t/m {new Date(lease.end_date).toLocaleDateString('nl-NL')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(lease.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => setPreviewLease(lease)}
                              className="text-blue-400 hover:text-blue-300 transition-colors p-1.5 rounded hover:bg-dark-700"
                              title="Contract PDF bekijken"
                            >
                              <FileText size={18} />
                            </button>
                            <button
                              onClick={() => handleEdit(lease)}
                              className="text-gold-500 hover:text-gold-400 transition-colors p-1.5 rounded hover:bg-dark-700"
                              title="Bewerken"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(lease)}
                              className="text-red-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-dark-700"
                              title="Verwijderen"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={regularPage}
              totalItems={regularLeases.length}
              pageSize={regularPageSize}
              onPageChange={(page) => { setRegularPage(page); }}
              onPageSizeChange={(size) => { setRegularPageSize(size); setRegularPage(1); }}
              label="huurcontracten"
            />
          </div>
        )}

        {regularLeases.length === 0 && (
          <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 bg-dark-800 border-b border-amber-500">
              <h2 className="text-lg font-bold text-gray-100">
                Huurcontracten
              </h2>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                disabled={tenants.length === 0 || spaces.length === 0}
              >
                <Plus size={20} />
                Huurcontract Aanmaken
              </button>
            </div>
            <div className="p-8 text-center">
              <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Nog geen huurcontracten. Klik op "Huurcontract Aanmaken" om je eerste contract aan te maken.</p>
            </div>
          </div>
        )}
      </div>

      {previewLease && (
        <LeaseContractPreview
          leaseData={buildLeaseContractData(previewLease)}
          tenantCompanyName={previewLease.tenant.company_name}
          onClose={() => setPreviewLease(null)}
        />
      )}
    </div>
  );
}
