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
    lease_type: 'full_time' as 'full_time' | 'flex',
    daily_rate: '',
    days_per_week: '5',
    selected_days: [] as string[],
    flex_pricing_model: 'credit_based' as 'credit_based',
    flex_credits_per_month: '',
    flex_credit_rate: '',
    flex_day_type: 'full_day' as 'full_day' | 'half_day'
  });

  const [selectedSpaces, setSelectedSpaces] = useState<Array<{
    space_id: string;
    price_per_sqm: string;
  }>>([]);

  const [flexDefaultSchedule, setFlexDefaultSchedule] = useState({
    space_id: '',
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false
  });

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

    // Voor full_time leases is een ruimte verplicht, voor flex niet
    if (formData.lease_type === 'full_time' && selectedSpaces.length === 0) {
      alert('Selecteer minimaal één ruimte');
      return;
    }

    if (formData.lease_type === 'flex') {
      if (!formData.flex_credits_per_month || !formData.flex_credit_rate) {
        alert('Vul het aantal dagen en prijs per dag in voor de strippenkaart');
        return;
      }

      if (!flexDefaultSchedule.space_id) {
        alert('Selecteer een flex-ruimte voor de vaste weekindeling');
        return;
      }

      const hasAtLeastOneDay = flexDefaultSchedule.monday || flexDefaultSchedule.tuesday ||
                                flexDefaultSchedule.wednesday || flexDefaultSchedule.thursday ||
                                flexDefaultSchedule.friday;

      if (!hasAtLeastOneDay) {
        alert('Selecteer minimaal één dag voor de vaste weekindeling');
        return;
      }
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

    if (formData.lease_type === 'flex') {
      leaseData.flex_pricing_model = 'credit_based';
      leaseData.flex_daily_rate = null;
      leaseData.flex_monthly_rate = null;
      leaseData.flex_credits_per_month = parseInt(formData.flex_credits_per_month);
      leaseData.flex_credit_rate = parseFloat(formData.flex_credit_rate);
      leaseData.flex_day_type = formData.flex_day_type;
    }

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

      await supabase
        .from('flex_schedules')
        .delete()
        .eq('lease_id', editingLease.id);

      if (formData.lease_type === 'flex' && flexDefaultSchedule.space_id) {
        const { error: scheduleError } = await supabase
          .from('flex_schedules')
          .insert([{
            lease_id: editingLease.id,
            space_id: flexDefaultSchedule.space_id,
            monday: flexDefaultSchedule.monday,
            tuesday: flexDefaultSchedule.tuesday,
            wednesday: flexDefaultSchedule.wednesday,
            thursday: flexDefaultSchedule.thursday,
            friday: flexDefaultSchedule.friday
          }]);

        if (scheduleError) {
          console.error('Error updating flex schedule:', scheduleError);
          alert('Fout bij het bijwerken van de vaste weekindeling: ' + scheduleError.message);
          return;
        }
      } else if (formData.lease_type !== 'flex') {
        const leaseSpacesData = selectedSpaces.map(space => {
          const officeSpace = spaces.find(s => s.id === space.space_id);
          const effectivePrice = space.price_per_sqm || getDefaultRate(space.space_id);
          let monthlyRent = 0;
          if (officeSpace && effectivePrice) {
            const yearlyRent = officeSpace.square_footage * parseFloat(effectivePrice);
            const isAnnualRate = officeSpace.space_type === 'bedrijfsruimte' || officeSpace.space_type === 'buitenterrein';
            monthlyRent = isAnnualRate ? yearlyRent / 12 : yearlyRent;
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
          alert('Fout bij het bijwerken van ruimtes: ' + spaceError.message);
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

      if (formData.lease_type !== 'flex') {
        const leaseSpacesData = selectedSpaces.map(space => {
          const officeSpace = spaces.find(s => s.id === space.space_id);
          const effectivePrice = space.price_per_sqm || getDefaultRate(space.space_id);
          let monthlyRent = 0;
          if (officeSpace && effectivePrice) {
            const yearlyRent = officeSpace.square_footage * parseFloat(effectivePrice);
            const isAnnualRate = officeSpace.space_type === 'bedrijfsruimte' || officeSpace.space_type === 'buitenterrein';
            monthlyRent = isAnnualRate ? yearlyRent / 12 : yearlyRent;
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
          alert('Fout bij het aanmaken van ruimtes: ' + spaceError.message);
          return;
        }

        const spaceIds = selectedSpaces.map(s => s.space_id);
        await supabase
          .from('office_spaces')
          .update({ is_available: false })
          .in('id', spaceIds);
      } else if (formData.lease_type === 'flex' && flexDefaultSchedule.space_id) {
        const { error: scheduleError } = await supabase
          .from('flex_schedules')
          .insert([{
            lease_id: newLease.id,
            space_id: flexDefaultSchedule.space_id,
            monday: flexDefaultSchedule.monday,
            tuesday: flexDefaultSchedule.tuesday,
            wednesday: flexDefaultSchedule.wednesday,
            thursday: flexDefaultSchedule.thursday,
            friday: flexDefaultSchedule.friday
          }]);

        if (scheduleError) {
          console.error('Error creating flex schedule:', scheduleError);
          alert('Fout bij het aanmaken van de vaste weekindeling: ' + scheduleError.message);
          return;
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
      lease_type: (lease as any).lease_type || 'full_time',
      daily_rate: (lease as any).daily_rate?.toString() || '',
      days_per_week: (lease as any).days_per_week?.toString() || '5',
      selected_days: (lease as any).selected_days || [],
      flex_pricing_model: 'credit_based' as 'credit_based',
      flex_credits_per_month: (lease as any).flex_credits_per_month?.toString() || '',
      flex_credit_rate: (lease as any).flex_credit_rate?.toString() || '',
      flex_day_type: (lease as any).flex_day_type || 'full_day'
    });
    setSelectedSpaces(lease.lease_spaces.map(ls => ({
      space_id: ls.space_id,
      price_per_sqm: ls.price_per_sqm.toString()
    })));

    if ((lease as any).lease_type === 'flex') {
      const { data: schedule } = await supabase
        .from('flex_schedules')
        .select('*')
        .eq('lease_id', lease.id)
        .maybeSingle();

      if (schedule) {
        setFlexDefaultSchedule({
          space_id: schedule.space_id,
          monday: schedule.monday,
          tuesday: schedule.tuesday,
          wednesday: schedule.wednesday,
          thursday: schedule.thursday,
          friday: schedule.friday
        });
      }
    }

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

    if (formData.lease_type === 'flex') {
      if (formData.flex_credits_per_month && formData.flex_credit_rate) {
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
      flex_pricing_model: 'credit_based',
      flex_credits_per_month: '',
      flex_credit_rate: '',
      flex_day_type: 'full_day'
    });
    setSelectedSpaces([]);
    setFlexDefaultSchedule({
      space_id: '',
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false
    });
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
    if (lease.lease_type === 'flex') {
      const flexLease = lease as any;
      if (flexLease.flex_credits_per_month && flexLease.flex_credit_rate) {
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
  const currentLeases = activeTab === 'active' ? activeLeases : expiredLeases;

  const regularLeases = currentLeases.filter(l => (l as any).lease_type !== 'flex');
  const flexLeases = currentLeases.filter(l => (l as any).lease_type === 'flex');

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
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Huurtype
                </label>
                <select
                  value={formData.lease_type}
                  onChange={(e) => setFormData({ ...formData, lease_type: e.target.value as 'full_time' | 'flex' })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <option value="full_time">Voltijd (alle dagen)</option>
                  <option value="flex">Flexplek</option>
                </select>
              </div>

              {formData.lease_type === 'flex' && (
                <>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-300 mb-1">Flexplek Huurcontract</h4>
                    <p className="text-sm text-gray-300">
                      Flexplek huurders krijgen geen vaste ruimte toegewezen. Ze kunnen gebruik maken van beschikbare werkplekken.
                      In Ruimtebeheer kun je aangeven welke ruimtes beschikbaar zijn voor flex gebruik.
                    </p>
                  </div>
                </div>
              </div>

                <div className="bg-dark-950 p-4 rounded-lg space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-400 mb-3">
                      Flex-contract werkt met een strippenkaart systeem
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Type dag
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="flex_day_type"
                            value="full_day"
                            checked={formData.flex_day_type === 'full_day'}
                            onChange={(e) => setFormData({ ...formData, flex_day_type: e.target.value as 'full_day' | 'half_day' })}
                            className="w-4 h-4 text-gold-500 focus:ring-gold-500"
                          />
                          <span className="text-gray-300">Hele dag</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="flex_day_type"
                            value="half_day"
                            checked={formData.flex_day_type === 'half_day'}
                            onChange={(e) => setFormData({ ...formData, flex_day_type: e.target.value as 'full_day' | 'half_day' })}
                            className="w-4 h-4 text-gold-500 focus:ring-gold-500"
                          />
                          <span className="text-gray-300">Halve dag</span>
                        </label>
                      </div>
                      {formData.flex_day_type === 'half_day' && (
                        <p className="text-xs text-gray-400 mt-1">
                          Bij halve dagen betaalt de flexer per halve dag. 1 dag = 2 halve dagen.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1">
                          Aantal {formData.flex_day_type === 'half_day' ? 'halve' : 'hele'} dagen per maand
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
                          Prijs per {formData.flex_day_type === 'half_day' ? 'halve' : 'hele'} dag
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
                          Maandhuur: €{parseFloat(formData.flex_credit_rate).toFixed(2)} × {formData.flex_credits_per_month} {formData.flex_day_type === 'half_day' ? 'halve dagen' : 'dagen'} =
                          <span className="font-bold text-gold-500 ml-1">
                            €{(parseFloat(formData.flex_credit_rate) * parseInt(formData.flex_credits_per_month)).toFixed(2)}/mnd
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dark-700 pt-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-200 mb-3">
                      Vaste weekindeling *
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Flex-ruimte *
                        </label>
                        <select
                          value={flexDefaultSchedule.space_id}
                          onChange={(e) => setFlexDefaultSchedule({ ...flexDefaultSchedule, space_id: e.target.value })}
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:border-gold-500"
                          required
                        >
                          <option value="">Selecteer een flex-ruimte</option>
                          {spaces.filter(s => s.is_flex_space).map(space => (
                            <option key={space.id} value={space.id}>
                              {space.space_number}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Vaste dagen *
                        </label>
                        <div className="flex gap-2">
                          {[
                            { key: 'monday', label: 'Ma' },
                            { key: 'tuesday', label: 'Di' },
                            { key: 'wednesday', label: 'Wo' },
                            { key: 'thursday', label: 'Do' },
                            { key: 'friday', label: 'Vr' }
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setFlexDefaultSchedule({
                                ...flexDefaultSchedule,
                                [key]: !(flexDefaultSchedule as any)[key]
                              })}
                              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                                (flexDefaultSchedule as any)[key]
                                  ? 'bg-gold-500 text-white'
                                  : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Selecteer de dagen waarop deze flexer standaard de ruimte gebruikt
                        </p>
                      </div>
                    </div>
                  </div>
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

      <div className="space-y-6">
        {regularLeases.length > 0 && (
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
                  {regularLeases.map((lease) => {
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
        )}

        {flexLeases.length > 0 && (
          <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 bg-dark-800 border-b border-amber-500">
              <h2 className="text-lg font-bold text-gray-100">
                Flexcontracten
              </h2>
              {regularLeases.length === 0 && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                  disabled={tenants.length === 0 || spaces.length === 0}
                >
                  <Plus size={20} />
                  Huurcontract Aanmaken
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[1000px]">
                <thead>
                  <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                    <th className="text-left px-4 py-3 font-semibold w-[15%]">Huurder</th>
                    <th className="text-left px-4 py-3 font-semibold w-[20%]">Flexplek</th>
                    <th className="text-right px-4 py-3 font-semibold w-[12%]">Maandhuur</th>
                    <th className="text-left px-4 py-3 font-semibold w-[10%]">BTW</th>
                    <th className="text-left px-4 py-3 font-semibold w-[18%]">Periode</th>
                    <th className="text-center px-4 py-3 font-semibold w-[12%]">Status</th>
                    <th className="text-right px-4 py-3 font-semibold w-[13%]">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {flexLeases.map((lease) => {
                    const totalRent = calculateLeaseTotal(lease);
                    return (
                      <tr
                        key={lease.id}
                        className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-100 font-medium">{lease.tenant.company_name}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
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
                                  const dayType = flexLease.flex_day_type === 'half_day' ? 'halve dagen' : 'dagen';
                                  const perType = flexLease.flex_day_type === 'half_day' ? 'halve dag' : 'dag';
                                  return `Strippenkaart: ${flexLease.flex_credits_per_month} ${dayType} × €${flexLease.flex_credit_rate?.toFixed(2)}/${perType}`;
                                })()}
                              </div>
                            </div>
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
        )}

        {regularLeases.length === 0 && flexLeases.length === 0 && (
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
    </div>
  );
}
