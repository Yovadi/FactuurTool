import { useState, useEffect } from 'react';
import { supabase, type OfficeSpace, type Lease, type LeaseSpace, type Tenant } from '../lib/supabase';
import { Plus, CreditCard as Edit2, Trash2, Home, Square, User, AlertCircle } from 'lucide-react';

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
    is_available: true,
    is_furnished: false,
    is_flex_space: false
  });

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    setLoading(true);
    const { data: spacesData, error } = await supabase
      .from('office_spaces')
      .select('*');

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

    // Sort spaces by name (space_number)
    spacesWithTenants.sort((a, b) => {
      const nameA = a.space_number.toLowerCase();
      const nameB = b.space_number.toLowerCase();
      return nameA.localeCompare(nameB);
    });

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
      is_available: formData.is_available,
      is_furnished: formData.space_type === 'kantoor' ? formData.is_furnished : null,
      is_flex_space: formData.is_flex_space
    };

    spaceData.hourly_rate = null;

    if (editingSpace) {
      const { data, error } = await supabase
        .from('office_spaces')
        .update(spaceData)
        .eq('id', editingSpace.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating space:', error);
        return;
      }

      if (data) {
        const updatedSpace: SpaceWithTenant = {
          ...data,
          tenant: spaces.find(s => s.id === editingSpace.id)?.tenant,
          is_available: data.is_available
        };
        setSpaces(spaces.map(s => s.id === editingSpace.id ? updatedSpace : s));
      }
    } else {
      const { data, error } = await supabase
        .from('office_spaces')
        .insert([spaceData])
        .select()
        .single();

      if (error) {
        console.error('Error creating space:', error);
        return;
      }

      if (data) {
        const newSpace: SpaceWithTenant = { ...data, is_available: data.is_available };
        setSpaces([...spaces, newSpace]);
      }
    }

    resetForm();
  };

  const handleEdit = (space: OfficeSpace) => {
    setEditingSpace(space);
    setFormData({
      space_type: space.space_type,
      space_number: space.space_number,
      square_footage: space.square_footage.toString(),
      is_available: space.is_available,
      is_furnished: space.is_furnished || false,
      is_flex_space: (space as any).is_flex_space || false
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
      return;
    }

    setSpaces(spaces.filter(s => s.id !== id));
  };

  const resetForm = () => {
    setFormData({
      space_type: 'bedrijfsruimte',
      space_number: '',
      square_footage: '',
      is_available: true,
      is_furnished: false,
      is_flex_space: false
    });
    setEditingSpace(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="text-center py-8">Ruimtes laden...</div>;
  }

  return (
    <div className="h-full bg-dark-950 overflow-y-auto p-6">
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
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md border border-dark-700">
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
                      is_furnished: newType === 'kantoor' ? formData.is_furnished : false,
                      is_flex_space: formData.is_flex_space
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
              {formData.space_type === 'kantoor' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_furnished"
                    checked={formData.is_furnished}
                    onChange={(e) => setFormData({ ...formData, is_furnished: e.target.checked })}
                    className="w-4 h-4 text-gold-500 border-dark-600 rounded focus:ring-2 focus:ring-gold-500"
                  />
                  <label htmlFor="is_furnished" className="text-sm font-medium text-gray-200">
                    Gemeubileerd
                  </label>
                </div>
              )}
              {formData.space_type !== 'Meeting Room' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_flex_space"
                    checked={formData.is_flex_space}
                    onChange={(e) => setFormData({ ...formData, is_flex_space: e.target.checked })}
                    className="w-4 h-4 text-gold-500 border-dark-600 rounded focus:ring-2 focus:ring-gold-500"
                  />
                  <label htmlFor="is_flex_space" className="text-sm font-medium text-gray-200">
                    Ook beschikbaar als Flexplek
                  </label>
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
        {['bedrijfsruimte', 'buitenterrein', 'diversen', 'kantoor', 'Meeting Room'].map(type => {
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
            <div key={type} className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 overflow-hidden">
              <h2 className="text-lg font-bold text-gray-100 px-4 py-3 bg-dark-800 border-b border-amber-500">
                {typeLabels[type]}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="border-b border-dark-700 text-gray-300 text-xs uppercase bg-dark-800">
                      <th className="text-left px-4 py-3 font-semibold w-[25%]">Benaming</th>
                      <th className="text-left px-4 py-3 font-semibold w-[20%]">
                        {type === 'Meeting Room' ? 'Type' : type === 'diversen' ? 'Bedrag' : 'Oppervlakte'}
                      </th>
                      <th className="text-left px-4 py-3 font-semibold w-[25%]">Huurder</th>
                      <th className="text-center px-4 py-3 font-semibold w-[15%]">Status</th>
                      <th className="text-right px-4 py-3 font-semibold w-[15%]">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typedSpaces.map((space) => (
                      <tr
                        key={space.id}
                        className="border-b border-dark-800 hover:bg-dark-800 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Home className="text-gold-500" size={18} />
                            <span className="text-gray-100 font-medium">{space.space_number}</span>
                            {space.space_type === 'kantoor' && space.is_furnished && (
                              <span className="text-xs bg-gold-500 text-dark-950 px-2 py-0.5 rounded-full font-medium">
                                Gemeubileerd
                              </span>
                            )}
                            {(space as any).is_flex_space && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-medium">
                                Beschikbaar voor Flex
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {space.space_type === 'Meeting Room'
                            ? 'Vergaderruimte'
                            : space.space_type === 'diversen'
                            ? `€ ${space.square_footage.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `${space.square_footage.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m²`
                          }
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {!space.is_available && space.tenant ? (
                            <div className="flex items-center gap-1">
                              <User size={14} />
                              <span>{space.tenant.company_name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500 italic">Geen huurder</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              space.is_available
                                ? 'bg-green-900 text-green-300 border border-green-700'
                                : 'bg-red-900 text-red-300 border border-red-700'
                            }`}
                          >
                            {space.is_available ? 'Beschikbaar' : 'Verhuurd'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => handleEdit(space)}
                              className="text-gold-500 hover:text-gold-400 transition-colors p-1.5 rounded hover:bg-dark-700"
                              title="Bewerken"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(space.id)}
                              className="text-red-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-dark-700"
                              title="Verwijderen"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {spaces.length === 0 && (
        <div className="bg-dark-900 rounded-lg p-8 text-center">
          <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Nog geen ruimtes. Klik op "Ruimte Toevoegen" om je eerste ruimte aan te maken.</p>
        </div>
      )}
    </div>
  );
}
