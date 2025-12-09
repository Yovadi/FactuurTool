import { useState, useEffect } from 'react';
import { supabase, type Lease, type Tenant, type OfficeSpace, type LeaseSpace, type SpaceTypeRate } from '../lib/supabase';
import { Plus, CreditCard as Edit2, Trash2, Calendar, Euro, X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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
    lease_type: 'full_time' as 'full_time' | 'part_time' | 'flex',
    daily_rate: '',
    days_per_week: '5',
    selected_days: [] as string[],
    flex_pricing_model: 'daily' as 'daily' | 'monthly_unlimited' | 'credit_based',
    flex_daily_rate: '',
    flex_monthly_rate: '',
    flex_credits_per_month: '',
    flex_credit_rate: ''
  });

  const [selectedSpaces, setSelectedSpaces] = useState<Array<{
    space_id: string;
    price_per_sqm: string;
  }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showForm && !editingLease && selectedSpaces.length === 0 && formData.lease_type === 'full_time') {
      setSelectedSpaces([{ space_id: '', price_per_sqm: '' }]);
    }
  }, [showForm, editingLease, formData.lease_type]);

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

    const { data: ratesData } = await supabase
      .from('space_type_rates')
      .select('*');

    setLeases(leasesData as LeaseWithDetails[] || []);
    setTenants(tenantsData || []);
    setSpaces(spacesData || []);
    setSpaceTypeRates(ratesData || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSpaces.length === 0) {
      console.error('Selecteer minimaal één kantoorruimte');
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
      lease_type: formData.lease_type
    };

    if (formData.lease_type === 'part_time') {
      leaseData.daily_rate = parseFloat(formData.daily_rate);
      leaseData.days_per_week = parseInt(formData.days_per_week);
      leaseData.selected_days = formData.selected_days.length > 0 ? formData.selected_days : null;
    } else if (formData.lease_type === 'flex') {
      leaseData.flex_pricing_model = formData.flex_pricing_model;
      leaseData.flex_daily_rate = formData.flex_daily_rate ? parseFloat(formData.flex_daily_rate) : 0;
      leaseData.flex_monthly_rate = formData.flex_monthly_rate ? parseFloat(formData.flex_monthly_rate) : 0;
      leaseData.flex_credits_per_month = formData.flex_credits_per_month ? parseInt(formData.flex_credits_per_month) : 0;
      leaseData.flex_credit_rate = formData.flex_credit_rate ? parseFloat(formData.flex_credit_rate) : 0;
    }

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
        const effectivePrice = space.price_per_sqm || getDefaultRate(space.space_id);
        let monthlyRent = 0;
        if (officeSpace && effectivePrice) {
          const yearlyRent = officeSpace.square_footage * parseFloat(effectivePrice);
          monthlyRent = officeSpace.space_type === 'bedrijfsruimte' ? yearlyRent / 12 : yearlyRent;
        }
        return {
          lease_id: editingLease.id,
          space_id: space.space_id,
          price_per_sqm: parseFloat(effectivePrice),
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
        return;
      }

      const leaseSpacesData = selectedSpaces.map(space => {
        const officeSpace = spaces.find(s => s.id === space.space_id);
        const effectivePrice = space.price_per_sqm || getDefaultRate(space.space_id);
        let monthlyRent = 0;
        if (officeSpace && effectivePrice) {
          const yearlyRent = officeSpace.square_footage * parseFloat(effectivePrice);
          monthlyRent = officeSpace.space_type === 'bedrijfsruimte' ? yearlyRent / 12 : yearlyRent;
        }
        return {
          lease_id: newLease.id,
          space_id: space.space_id,
          price_per_sqm: parseFloat(effectivePrice),
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

      resetForm();
      loadData();
    }
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
      status: lease.status,
      lease_type: (lease as any).lease_type || 'full_time',
      daily_rate: (lease as any).daily_rate?.toString() || '',
      days_per_week: (lease as any).days_per_week?.toString() || '5',
      selected_days: (lease as any).selected_days || [],
      flex_pricing_model: (lease as any).flex_pricing_model || 'daily',
      flex_daily_rate: (lease as any).flex_daily_rate?.toString() || '',
      flex_monthly_rate: (lease as any).flex_monthly_rate?.toString() || '',
      flex_credits_per_month: (lease as any).flex_credits_per_month?.toString() || '',
      flex_credit_rate: (lease as any).flex_credit_rate?.toString() || ''
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

    await supabase
      .from('office_spaces')
      .update({ is_available: true })
      .in('id', spaceIds);

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

    const rate = spaceTypeRates.find(r => r.space_type === space.space_type);
    if (!rate) return '';

    const isFurnished = space.is_furnished ?? false;

    let pricePerSqm = 0;

    if (rate.calculation_method === 'per_sqm') {
      pricePerSqm = isFurnished && space.space_type === 'kantoor'
        ? rate.rate_per_sqm_furnished
        : rate.rate_per_sqm;
    } else if (rate.calculation_method === 'custom') {
      pricePerSqm = isFurnished && space.space_type === 'kantoor'
        ? rate.rate_per_sqm_furnished
        : rate.rate_per_sqm;
    }

    return pricePerSqm > 0 ? pricePerSqm.toFixed(2) : '';
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
    if (!space) return 0;

    const effectivePrice = pricePerSqm || getDefaultRate(spaceId);
    if (!effectivePrice) return 0;

    const yearlyRent = space.square_footage * parseFloat(effectivePrice);
    return space.space_type === 'bedrijfsruimte' ? yearlyRent / 12 : yearlyRent;
  };

  const getTotalMonthlyRent = () => {
    let spacesTotal = 0;

    if (formData.lease_type === 'part_time' && formData.daily_rate && formData.days_per_week) {
      const dailyRate = parseFloat(formData.daily_rate);
      const daysPerWeek = parseInt(formData.days_per_week);
      spacesTotal = dailyRate * daysPerWeek * 4.33;
    } else if (formData.lease_type === 'flex') {
      if (formData.flex_pricing_model === 'daily' && formData.flex_daily_rate) {
        spacesTotal = parseFloat(formData.flex_daily_rate) * 20;
      } else if (formData.flex_pricing_model === 'monthly_unlimited' && formData.flex_monthly_rate) {
        spacesTotal = parseFloat(formData.flex_monthly_rate);
      } else if (formData.flex_pricing_model === 'credit_based' && formData.flex_credits_per_month && formData.flex_credit_rate) {
        spacesTotal = parseInt(formData.flex_credits_per_month) * parseFloat(formData.flex_credit_rate);
      }
    } else {
      spacesTotal = selectedSpaces.reduce((sum, space) => {
        return sum + calculateSpaceRent(space.space_id, space.price_per_sqm);
      }, 0);
    }

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
      status: 'active',
      lease_type: 'full_time',
      daily_rate: '',
      days_per_week: '5',
      selected_days: [],
      flex_pricing_model: 'daily',
      flex_daily_rate: '',
      flex_monthly_rate: '',
      flex_credits_per_month: '',
      flex_credit_rate: ''
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
    if (lease.lease_type === 'part_time' && lease.daily_rate && lease.days_per_week) {
      return Math.round(lease.daily_rate * lease.days_per_week * 4.33 * 100) / 100;
    } else if (lease.lease_type === 'flex') {
      const flexLease = lease as any;
      if (flexLease.flex_pricing_model === 'daily' && flexLease.flex_daily_rate) {
        return Math.round(flexLease.flex_daily_rate * 20 * 100) / 100;
      } else if (flexLease.flex_pricing_model === 'monthly_unlimited' && flexLease.flex_monthly_rate) {
        return Math.round(flexLease.flex_monthly_rate * 100) / 100;
      } else if (flexLease.flex_pricing_model === 'credit_based' && flexLease.flex_credits_per_month && flexLease.flex_credit_rate) {
        return Math.round(flexLease.flex_credits_per_month * flexLease.flex_credit_rate * 100) / 100;
      }
    }
    return lease.lease_spaces.reduce((sum, ls) => sum + ls.monthly_rent, 0);
  };

  if (loading) {
    return <div className="text-center py-8">Huurcontracten laden...</div>;
  }

  const activeLeases = leases.filter(l => l.status === 'active');
  const expiredLeases = leases.filter(l => l.status === 'expired' || l.status === 'terminated');
  const displayedLeases = activeTab === 'active' ? activeLeases : expiredLeases;

  return (
    <div>

      <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-2 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-gold-500 text-dark-950'
                : 'text-gray-300 hover:bg-dark-800'
            }`}
          >
            <CheckCircle size={18} />
            Actief ({activeLeases.length})
          </button>
          <button
            onClick={() => setActiveTab('expired')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'expired'
                ? 'bg-gold-500 text-dark-950'
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
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Huurtype
                </label>
                <select
                  value={formData.lease_type}
                  onChange={(e) => setFormData({ ...formData, lease_type: e.target.value as 'full_time' | 'part_time' | 'flex' })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <option value="full_time">Voltijd (alle dagen)</option>
                  <option value="part_time">Deeltijd (x dagen per week)</option>
                  <option value="flex">Flexplek</option>
                </select>
              </div>

              {formData.lease_type === 'flex' && (
                <>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-200">
                    Flexplek Ruimte
                  </label>
                </div>
                <select
                  required
                  value={selectedSpaces.length > 0 ? selectedSpaces[0].space_id : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedSpaces([{ space_id: e.target.value, price_per_sqm: '0' }]);
                    } else {
                      setSelectedSpaces([]);
                    }
                  }}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <option value="">Selecteer een flexplek...</option>
                  {spaces
                    .filter(s => {
                      const occupiedSpaceIds = leases
                        .filter(l => !editingLease || l.id !== editingLease.id)
                        .flatMap(l => l.lease_spaces.map(ls => ls.space_id));
                      return !occupiedSpaceIds.includes(s.id) && (s as any).is_flex_space === true;
                    })
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.space_number} - {s.space_type === 'kantoor' ? 'Kantoor' : s.space_type === 'bedrijfsruimte' ? 'Bedrijfsruimte' : 'Overig'}
                      </option>
                    ))}
                </select>
              </div>

                <div className="bg-dark-950 p-4 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Tariefmodel
                    </label>
                    <select
                      value={formData.flex_pricing_model}
                      onChange={(e) => setFormData({ ...formData, flex_pricing_model: e.target.value as 'daily' | 'monthly_unlimited' | 'credit_based' })}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    >
                      <option value="daily">Per dag (x dagen per maand)</option>
                      <option value="monthly_unlimited">Vast maandbedrag (onbeperkt)</option>
                      <option value="credit_based">Strippenkaart (X dagen per maand)</option>
                    </select>
                  </div>

                  {formData.flex_pricing_model === 'daily' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Prijs per dag
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        placeholder="Bijv. 50"
                        value={formData.flex_daily_rate}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setFormData({ ...formData, flex_daily_rate: value });
                          }
                        }}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                      {formData.flex_daily_rate && (
                        <div className="mt-2 text-sm text-gray-300">
                          Geschatte maandhuur (20 werkdagen):
                          <span className="font-bold text-gold-500 ml-1">
                            €{(parseFloat(formData.flex_daily_rate) * 20).toFixed(2)}/mnd
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {formData.flex_pricing_model === 'monthly_unlimited' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Vast maandbedrag (onbeperkt gebruik)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        placeholder="Bijv. 500"
                        value={formData.flex_monthly_rate}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setFormData({ ...formData, flex_monthly_rate: value });
                          }
                        }}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                  )}

                  {formData.flex_pricing_model === 'credit_based' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">
                            Aantal dagen per maand
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            placeholder="Bijv. 10"
                            value={formData.flex_credits_per_month}
                            onChange={(e) => setFormData({ ...formData, flex_credits_per_month: e.target.value })}
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">
                            Prijs per dag
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            required
                            placeholder="Bijv. 45"
                            value={formData.flex_credit_rate}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                setFormData({ ...formData, flex_credit_rate: value });
                              }
                            }}
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                          />
                        </div>
                      </div>
                      {formData.flex_credits_per_month && formData.flex_credit_rate && (
                        <div className="pt-2 border-t border-dark-700">
                          <div className="text-sm text-gray-300">
                            Maandhuur: €{parseFloat(formData.flex_credit_rate).toFixed(2)} × {formData.flex_credits_per_month} dagen =
                            <span className="font-bold text-gold-500 ml-1">
                              €{(parseFloat(formData.flex_credit_rate) * parseInt(formData.flex_credits_per_month)).toFixed(2)}/mnd
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </>
              )}

              {formData.lease_type === 'part_time' && (
                <>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-200">
                    Kantoorruimte
                  </label>
                </div>
                <select
                  required
                  value={selectedSpaces.length > 0 ? selectedSpaces[0].space_id : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedSpaces([{ space_id: e.target.value, price_per_sqm: '0' }]);
                    } else {
                      setSelectedSpaces([]);
                    }
                  }}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <option value="">Selecteer een kantoor...</option>
                  {spaces
                    .filter(s => {
                      const occupiedSpaceIds = leases
                        .filter(l => !editingLease || l.id !== editingLease.id)
                        .flatMap(l => l.lease_spaces.map(ls => ls.space_id));
                      return !occupiedSpaceIds.includes(s.id) && s.space_type === 'kantoor';
                    })
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.space_number} ({s.square_footage} m²)
                      </option>
                    ))}
                </select>
              </div>

                <div className="bg-dark-950 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Prijs per dag
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        placeholder="Bijv. 50"
                        value={formData.daily_rate}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setFormData({ ...formData, daily_rate: value });
                          }
                        }}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Aantal dagen per week
                      </label>
                      <select
                        value={formData.days_per_week}
                        onChange={(e) => {
                          setFormData({ ...formData, days_per_week: e.target.value, selected_days: [] });
                        }}
                        className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      >
                        <option value="1">1 dag</option>
                        <option value="2">2 dagen</option>
                        <option value="3">3 dagen</option>
                        <option value="4">4 dagen</option>
                        <option value="5">5 dagen</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Welke dagen? (optioneel)
                    </label>
                    <div className="flex gap-2">
                      {['ma', 'di', 'wo', 'do', 'vr'].map((day) => {
                        const maxDays = parseInt(formData.days_per_week);
                        const isSelected = formData.selected_days.includes(day);
                        const canSelect = isSelected || formData.selected_days.length < maxDays;

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (!canSelect && !isSelected) return;
                              const newDays = isSelected
                                ? formData.selected_days.filter(d => d !== day)
                                : [...formData.selected_days, day];
                              setFormData({ ...formData, selected_days: newDays });
                            }}
                            disabled={!canSelect && !isSelected}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-gold-500 text-white'
                                : canSelect
                                ? 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                                : 'bg-dark-800 text-gray-600 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {formData.daily_rate && formData.days_per_week && (
                    <div className="pt-2 border-t border-dark-700">
                      <div className="text-sm text-gray-300">
                        Berekening: €{parseFloat(formData.daily_rate).toFixed(2)} × {formData.days_per_week} dagen × 4,33 weken =
                        <span className="font-bold text-gold-500 ml-1">
                          €{(parseFloat(formData.daily_rate) * parseInt(formData.days_per_week) * 4.33).toFixed(2)}/mnd
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                </>
              )}

              {formData.lease_type === 'full_time' && (
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
                                {selectedSpace.space_number} - {selectedSpace.space_type === 'kantoor' ? 'Kantoor' : selectedSpace.space_type === 'buitenterrein' ? 'Buitenterrein' : selectedSpace.space_type === 'bedrijfsruimte' ? 'Bedrijfsruimte' : selectedSpace.space_type === 'meeting_room' ? 'Vergaderruimte' : 'Overig'} ({selectedSpace.square_footage} m²)
                              </option>
                            )}
                            {availableSpaces.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.space_number} - {s.space_type === 'kantoor' ? 'Kantoor' : s.space_type === 'buitenterrein' ? 'Buitenterrein' : s.space_type === 'bedrijfsruimte' ? 'Bedrijfsruimte' : s.space_type === 'meeting_room' ? 'Vergaderruimte' : 'Overig'} ({s.square_footage} m²)
                              </option>
                            ))}
                          </select>
                          {space.space_id && selectedSpace && (
                            <div className="flex gap-2 items-center bg-dark-950 p-3 rounded-lg">
                              <div className="flex-1">
                                <div className="text-sm text-gray-400 mb-1">Tarief per m²</div>
                                <div className="text-lg font-bold text-gold-500">
                                  €{(() => {
                                    const effectivePrice = space.price_per_sqm || getDefaultRate(space.space_id);
                                    return effectivePrice ? parseFloat(effectivePrice).toFixed(2) : '0.00';
                                  })()}/m²
                                </div>
                                {space.space_id && getDefaultRate(space.space_id) && (
                                  <div className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
                                    <CheckCircle size={12} />
                                    Standaardtarief
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
                                <div className="text-xs text-gray-500 mt-1">
                                  {selectedSpace.space_type === 'bedrijfsruimte'
                                    ? `${selectedSpace.square_footage} m² × tarief / 12`
                                    : `${selectedSpace.square_footage} m² × tarief`
                                  }
                                </div>
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
              )}

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
        <div className="overflow-x-auto">
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
              {displayedLeases.map((lease) => {
                const totalRent = calculateLeaseTotal(lease);
                return (
                  <tr
                    key={lease.id}
                    className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-100 font-medium">{lease.tenant.company_name}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {lease.lease_type === 'flex' ? (
                          <div className="text-xs text-gray-300">
                            <div className="flex items-center gap-2">
                              {lease.lease_spaces.length > 0 && (
                                <span className="font-medium">{lease.lease_spaces[0].space.space_number}</span>
                              )}
                              <span className="text-blue-500 font-medium">Flexplek</span>
                            </div>
                            <div className="text-gray-400 mt-1">
                              {(() => {
                                const flexLease = lease as any;
                                if (flexLease.flex_pricing_model === 'daily') {
                                  return `€${flexLease.flex_daily_rate?.toFixed(2)}/dag (ca. 20 dagen/mnd)`;
                                } else if (flexLease.flex_pricing_model === 'monthly_unlimited') {
                                  return `Onbeperkt - €${flexLease.flex_monthly_rate?.toFixed(2)}/mnd`;
                                } else if (flexLease.flex_pricing_model === 'credit_based') {
                                  return `${flexLease.flex_credits_per_month} dagen × €${flexLease.flex_credit_rate?.toFixed(2)}/dag`;
                                }
                                return 'Flexplek';
                              })()}
                            </div>
                          </div>
                        ) : lease.lease_type === 'part_time' ? (
                          <div className="text-xs text-gray-300">
                            <div className="flex items-center gap-2">
                              {lease.lease_spaces.length > 0 && (
                                <span className="font-medium">{lease.lease_spaces[0].space.space_number}</span>
                              )}
                              <span className="text-gold-500 font-medium">Deeltijd</span>
                            </div>
                            <div className="text-gray-400 mt-1">
                              {lease.days_per_week}x per week
                              {lease.selected_days && lease.selected_days.length > 0 && (
                                <span className="ml-1">({lease.selected_days.join(', ')})</span>
                              )}
                            </div>
                            <div className="text-gray-400">
                              €{lease.daily_rate?.toFixed(2)}/dag × {lease.days_per_week} × 4,33
                            </div>
                          </div>
                        ) : (
                          <>
                            {lease.lease_spaces.map((ls) => (
                              <div key={ls.id} className="text-xs text-gray-300 flex items-center gap-2">
                                <span className="font-medium">{ls.space.space_number}</span>
                                <span className="text-gray-400">({ls.space.square_footage} m² × €{ls.price_per_sqm}/m²)</span>
                              </div>
                            ))}
                          </>
                        )}
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
      </div>

      {leases.length === 0 && (
        <div className="bg-dark-900 rounded-lg p-8 text-center">
          <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Nog geen huurcontracten. Klik op "Huurcontract Aanmaken" om je eerste contract aan te maken.</p>
        </div>
      )}
    </div>
  );
}
