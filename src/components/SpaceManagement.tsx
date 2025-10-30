import { useState, useEffect } from 'react';
import { supabase, type OfficeSpace, type Lease, type LeaseSpace, type Tenant } from '../lib/supabase';
import { Plus, CreditCard as Edit2, Trash2, Home, Square, User } from 'lucide-react';

type SpaceWithTenant = OfficeSpace & {
  tenant?: Tenant;
};

export function SpaceManagement() {
  const [spaces, setSpaces] = useState<SpaceWithTenant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSpace, setEditingSpace] = useState<OfficeSpace | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    space_type: 'bedrijfsruimte' as 'bedrijfsruimte' | 'kantoor' | 'buitenterrein' | 'diversen' | 'Meeting Room',
    space_number: '',
    square_footage: '',
    hourly_rate: '',
    is_available: true
  });

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    setLoading(true);
    const { data: spacesData, error } = await supabase
      .from('office_spaces')
      .select('*')
      .order('floor')
      .order('space_number');

    if (error) {
      console.error('Error loading spaces:', error);
      setLoading(false);
      return;
    }

    const spacesWithTenants: SpaceWithTenant[] = await Promise.all(
      (spacesData || []).map(async (space) => {
        const { data: leaseSpaces } = await supabase
          .from('lease_spaces')
          .select('lease_id')
          .eq('space_id', space.id);

        if (leaseSpaces && leaseSpaces.length > 0) {
          const { data: lease } = await supabase
            .from('leases')
            .select('tenant_id, status')
            .eq('id', leaseSpaces[0].lease_id)
            .eq('status', 'active')
            .maybeSingle();

          if (lease) {
            const { data: tenant } = await supabase
              .from('tenants')
              .select('*')
              .eq('id', lease.tenant_id)
              .maybeSingle();

            if (tenant) {
              return { ...space, tenant, is_available: false };
            }
          }
        }

        return { ...space, is_available: true };
      })
    );

    setSpaces(spacesWithTenants);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const spaceData: any = {
      space_number: formData.space_number,
      floor: 0,
      square_footage: formData.space_type === 'Meeting Room' ? 0 : (parseFloat(formData.square_footage) || 0),
      space_type: formData.space_type,
      base_rent: 0,
      is_available: formData.is_available
    };

    if (formData.space_type === 'Meeting Room') {
      spaceData.hourly_rate = formData.hourly_rate ? parseFloat(formData.hourly_rate) : null;
    } else {
      spaceData.hourly_rate = null;
    }

    if (editingSpace) {
      const { error } = await supabase
        .from('office_spaces')
        .update(spaceData)
        .eq('id', editingSpace.id);

      if (error) {
        console.error('Error updating space:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('office_spaces')
        .insert([spaceData]);

      if (error) {
        console.error('Error creating space:', error);
        return;
      }
    }

    resetForm();
    loadSpaces();
  };

  const handleEdit = (space: OfficeSpace) => {
    setEditingSpace(space);
    setFormData({
      space_type: space.space_type,
      space_number: space.space_number,
      square_footage: space.square_footage.toString(),
      hourly_rate: space.hourly_rate ? space.hourly_rate.toString() : '',
      is_available: space.is_available
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('office_spaces')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting space:', error);
    } else {
      loadSpaces();
    }
  };

  const resetForm = () => {
    setFormData({
      space_type: 'bedrijfsruimte',
      space_number: '',
      square_footage: '',
      hourly_rate: '',
      is_available: true
    });
    setEditingSpace(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="text-center py-8">Ruimtes laden...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100">Ruimtes</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
        >
          <Plus size={20} />
          Ruimte Toevoegen
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {editingSpace ? 'Ruimte Bewerken' : 'Nieuwe Ruimte Toevoegen'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Ruimte Type *
                </label>
                <select
                  value={formData.space_type}
                  onChange={(e) => {
                    const newType = e.target.value as 'bedrijfsruimte' | 'kantoor' | 'buitenterrein' | 'diversen' | 'Meeting Room';
                    setFormData({
                      ...formData,
                      space_type: newType,
                      square_footage: newType === 'Meeting Room' ? '0' : formData.square_footage,
                      hourly_rate: newType === 'Meeting Room' ? formData.hourly_rate : ''
                    });
                  }}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  <option value="bedrijfsruimte">Bedrijfsruimte</option>
                  <option value="kantoor">Kantoor</option>
                  <option value="buitenterrein">Buitenterrein</option>
                  <option value="diversen">Diversen</option>
                  <option value="Meeting Room">Vergaderruimte</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Benaming *
                </label>
                <input
                  type="text"
                  required
                  value={formData.space_number}
                  onChange={(e) => setFormData({ ...formData, space_number: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  placeholder="bijv. Suite 101"
                />
              </div>
              {formData.space_type !== 'Meeting Room' && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    {formData.space_type === 'diversen' ? 'Bedrag *' : 'Oppervlakte (m²) *'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={formData.square_footage}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setFormData({ ...formData, square_footage: value });
                      }
                    }}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder={formData.space_type === 'diversen' ? 'bijv. 150.00' : 'bijv. 50.5'}
                  />
                </div>
              )}
              {formData.space_type === 'Meeting Room' && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Uurtarief (€)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.hourly_rate}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setFormData({ ...formData, hourly_rate: value });
                      }
                    }}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder="bijv. 25.00"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_available"
                  checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="w-4 h-4 text-gold-500 border-dark-600 rounded focus:ring-2 focus:ring-gold-500"
                />
                <label htmlFor="is_available" className="text-sm font-medium text-gray-200">
                  Beschikbaar voor Verhuur
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-gold-500 text-white px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  {editingSpace ? 'Bijwerken' : 'Aanmaken'}
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

      <div className="space-y-8">
        {['bedrijfsruimte', 'kantoor', 'buitenterrein', 'diversen', 'Meeting Room'].map(type => {
          const typedSpaces = spaces.filter(s => s.space_type === type);
          if (typedSpaces.length === 0) return null;

          const typeLabels: Record<string, string> = {
            bedrijfsruimte: 'Bedrijfsruimtes',
            kantoor: 'Kantoren',
            buitenterrein: 'Buitenterreinen',
            diversen: 'Diversen',
            'Meeting Room': 'Vergaderruimtes'
          };

          return (
            <div key={type}>
              <h2 className="text-xl font-bold text-gray-100 mb-4 pb-2 border-b-2 border-amber-500">
                {typeLabels[type]}
              </h2>
              <div className="space-y-3">
                {typedSpaces.map((space) => (
                  <div
                    key={space.id}
                    className="bg-dark-900 rounded-lg border border-dark-700 p-4 hover:border-dark-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <Home className="text-gray-500" size={24} />
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-semibold text-gray-100">
                              {space.space_number}
                            </h3>
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${
                                space.is_available
                                  ? 'bg-dark-700 text-green-400'
                                  : 'bg-red-900 text-red-400'
                              }`}
                            >
                              {space.is_available ? 'Beschikbaar' : 'Verhuurd'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-300">
                            {space.space_type !== 'Meeting Room' && (
                              <span className="flex items-center gap-1">
                                <Square size={14} />
                                {space.space_type === 'diversen'
                                  ? `€ ${space.square_footage.toLocaleString()}`
                                  : `${space.square_footage.toLocaleString()} m²`}
                              </span>
                            )}
                            {space.space_type === 'Meeting Room' && space.hourly_rate && (
                              <span>€{space.hourly_rate.toLocaleString()}/uur</span>
                            )}
                            {!space.is_available && space.tenant && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <User size={14} />
                                  {space.tenant.company_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(space)}
                          className="flex items-center gap-1 text-gold-500 hover:text-gold-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button
                          onClick={() => handleDelete(space.id)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-dark-800"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {spaces.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Nog geen ruimtes. Klik op "Ruimte Toevoegen" om je eerste ruimte aan te maken.
        </div>
      )}
    </div>
  );
}
