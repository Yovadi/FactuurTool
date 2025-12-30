import { useState, useEffect } from 'react';
import { supabase, type SpaceTypeRate } from '../lib/supabase';
import { Plus, Edit2, AlertCircle, Calculator, X, Building2, Euro, Clock } from 'lucide-react';

const SPACE_TYPE_LABELS: Record<string, string> = {
  'bedrijfsruimte': 'Bedrijfsruimte',
  'kantoor': 'Kantoor',
  'buitenterrein': 'Buitenterrein',
  'Meeting Room': 'Vergaderruimte',
  'Flexplek': 'Flexplek'
};

const CALCULATION_METHOD_LABELS: Record<string, string> = {
  'per_sqm': 'Per vierkante meter',
  'fixed_monthly': 'Vast maandbedrag',
  'hourly': 'Per uur',
  'daily': 'Per dag',
  'custom': 'Aangepast'
};

export function SpaceTypeRates() {
  const [rates, setRates] = useState<SpaceTypeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState<SpaceTypeRate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    space_type: '',
    rate_per_sqm: '',
    rate_per_sqm_furnished: '',
    calculation_method: 'per_sqm' as 'per_sqm' | 'fixed_monthly' | 'hourly' | 'custom' | 'daily',
    fixed_rate: '',
    fixed_rate_furnished: '',
    hourly_rate: '',
    daily_rate: '',
    daily_rate_furnished: '',
    is_annual: false,
    description: '',
    description_furnished: ''
  });

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('space_type_rates')
      .select('*')
      .order('space_type');

    if (error) {
      console.error('Error loading rates:', error);
      setLoading(false);
      return;
    }

    setRates(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let ratePerSqm = parseFloat(formData.rate_per_sqm) || 0;
    let ratePerSqmFurnished = parseFloat(formData.rate_per_sqm_furnished) || 0;
    let fixedRate = parseFloat(formData.fixed_rate) || 0;
    let fixedRateFurnished = parseFloat(formData.fixed_rate_furnished) || 0;

    if (formData.is_annual) {
      ratePerSqm = ratePerSqm / 12;
      ratePerSqmFurnished = ratePerSqmFurnished / 12;
      fixedRate = fixedRate / 12;
      fixedRateFurnished = fixedRateFurnished / 12;
    }

    const rateData = {
      space_type: formData.space_type,
      rate_per_sqm: ratePerSqm,
      rate_per_sqm_furnished: ratePerSqmFurnished,
      calculation_method: formData.calculation_method,
      fixed_rate: fixedRate,
      fixed_rate_furnished: fixedRateFurnished,
      hourly_rate: parseFloat(formData.hourly_rate) || 0,
      daily_rate: parseFloat(formData.daily_rate) || 0,
      daily_rate_furnished: parseFloat(formData.daily_rate_furnished) || 0,
      is_annual: formData.is_annual,
      description: formData.description,
      description_furnished: formData.description_furnished
    };

    if (editingRate) {
      const { error } = await supabase
        .from('space_type_rates')
        .update(rateData)
        .eq('id', editingRate.id);

      if (error) {
        console.error('Error updating rate:', error);
        setError(`Fout bij bijwerken: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase
        .from('space_type_rates')
        .insert([rateData]);

      if (error) {
        console.error('Error creating rate:', error);
        setError(`Fout bij toevoegen: ${error.message}`);
        return;
      }
    }

    resetForm();
    loadRates();
  };

  const handleEdit = (rate: SpaceTypeRate) => {
    setEditingRate(rate);

    const multiplier = rate.is_annual ? 12 : 1;

    setFormData({
      space_type: rate.space_type,
      rate_per_sqm: (rate.rate_per_sqm * multiplier).toString(),
      rate_per_sqm_furnished: (rate.rate_per_sqm_furnished * multiplier).toString(),
      calculation_method: rate.calculation_method,
      fixed_rate: (rate.fixed_rate * multiplier).toString(),
      fixed_rate_furnished: (rate.fixed_rate_furnished * multiplier).toString(),
      hourly_rate: rate.hourly_rate.toString(),
      daily_rate: rate.daily_rate.toString(),
      daily_rate_furnished: rate.daily_rate_furnished?.toString() || '',
      is_annual: rate.is_annual,
      description: rate.description || '',
      description_furnished: rate.description_furnished || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      space_type: '',
      rate_per_sqm: '',
      rate_per_sqm_furnished: '',
      calculation_method: 'per_sqm',
      fixed_rate: '',
      fixed_rate_furnished: '',
      hourly_rate: '',
      daily_rate: '',
      daily_rate_furnished: '',
      is_annual: false,
      description: '',
      description_furnished: ''
    });
    setEditingRate(null);
    setShowForm(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-dark-950 overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100">Ruimte Tarieven</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gold-500 text-dark-950 px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors font-medium"
        >
          <Plus size={20} />
          Tarief Toevoegen
        </button>
      </div>

      {rates.length === 0 ? (
        <div className="bg-dark-900 rounded-lg p-8 text-center border border-dark-700 mb-6">
          <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Nog geen tarieven ingesteld</p>
          <p className="text-sm text-gray-500 mt-2">Klik op "Tarief Toevoegen" om een nieuw tarief aan te maken</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {rates.map(rate => (
            <div key={rate.id} className="bg-dark-900 rounded-lg border border-dark-700 overflow-hidden hover:border-gold-500 transition-colors h-fit">
              <div className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-dark-700">
                <div className="flex items-center gap-2">
                  <Building2 className="text-gold-500" size={18} />
                  <h3 className="font-bold text-gray-100">
                    {SPACE_TYPE_LABELS[rate.space_type] || rate.space_type}
                  </h3>
                </div>
                <button
                  onClick={() => handleEdit(rate)}
                  className="text-gold-500 hover:text-gold-400 transition-colors p-1"
                  title="Bewerken"
                >
                  <Edit2 size={16} />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calculator size={14} className="text-gray-500" />
                  <span className="text-gray-400">Methode:</span>
                  <span className="text-gray-200 font-medium">
                    {CALCULATION_METHOD_LABELS[rate.calculation_method]}
                  </span>
                </div>

                {(rate.calculation_method === 'per_sqm' || rate.calculation_method === 'custom') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Standaard:</span>
                      <div className="flex items-center gap-1">
                        <Euro size={14} className="text-gold-500" />
                        <span className="text-gray-100 font-bold">€{rate.rate_per_sqm.toFixed(2)}</span>
                        <span className="text-gray-400">/m²</span>
                      </div>
                    </div>
                    {rate.space_type === 'kantoor' && rate.rate_per_sqm_furnished > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Gemeubileerd:</span>
                        <div className="flex items-center gap-1">
                          <Euro size={14} className="text-gold-500" />
                          <span className="text-gray-100 font-bold">€{rate.rate_per_sqm_furnished.toFixed(2)}</span>
                          <span className="text-gray-400">/m²</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(rate.calculation_method === 'fixed_monthly' || rate.calculation_method === 'custom') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Vast bedrag:</span>
                      <div className="flex items-center gap-1">
                        <Euro size={14} className="text-gold-500" />
                        <span className="text-gray-100 font-bold">€{rate.fixed_rate.toFixed(2)}</span>
                      </div>
                    </div>
                    {rate.space_type === 'kantoor' && rate.fixed_rate_furnished > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Gemeubileerd:</span>
                        <div className="flex items-center gap-1">
                          <Euro size={14} className="text-gold-500" />
                          <span className="text-gray-100 font-bold">€{rate.fixed_rate_furnished.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {rate.calculation_method === 'hourly' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Uurtarief:</span>
                    <div className="flex items-center gap-1">
                      <Clock size={14} className="text-gold-500" />
                      <span className="text-gray-100 font-bold">€{rate.hourly_rate.toFixed(2)}</span>
                      <span className="text-gray-400">/uur</span>
                    </div>
                  </div>
                )}

                {rate.calculation_method === 'daily' && (
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Dagprijs:</span>
                      <div className="flex items-center gap-1">
                        <Euro size={14} className="text-gold-500" />
                        <span className="text-gray-100 font-bold">€{rate.daily_rate.toFixed(2)}</span>
                        <span className="text-gray-400">/dag</span>
                      </div>
                    </div>
                    {rate.space_type === 'Flexplek' && rate.daily_rate_furnished > 0 && (
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-gray-400">Gemeubileerd:</span>
                        <div className="flex items-center gap-1">
                          <Euro size={14} className="text-gold-500" />
                          <span className="text-gray-100 font-bold">€{rate.daily_rate_furnished.toFixed(2)}</span>
                          <span className="text-gray-400">/dag</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(rate.space_type === 'bedrijfsruimte' || rate.space_type === 'buitenterrein') && (
                  <div className="pt-2 border-t border-dark-700">
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <AlertCircle size={12} />
                      <span>Jaarlijks tarief (wordt gedeeld door 12 voor maandfactuur)</span>
                    </div>
                  </div>
                )}

                {rate.is_annual && rate.space_type !== 'bedrijfsruimte' && rate.space_type !== 'buitenterrein' && (
                  <div className="pt-2 border-t border-dark-700">
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <AlertCircle size={12} />
                      <span>Jaarlijks tarief (gedeeld door 12)</span>
                    </div>
                  </div>
                )}

                {rate.description && (
                  <div className="pt-2 border-t border-dark-700">
                    <p className="text-xs text-gray-400">{rate.description}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-dark-700">
            <div className="flex justify-between items-center px-6 py-4 border-b border-dark-700">
              <h3 className="text-xl font-bold text-gray-100">
                {editingRate ? 'Tarief Bewerken' : 'Nieuw Tarief'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-900/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg flex items-start gap-2">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <div className="flex-1">{error}</div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Ruimte Type
                </label>
                <select
                  required
                  value={formData.space_type}
                  onChange={(e) => {
                    const newSpaceType = e.target.value;
                    setFormData({
                      ...formData,
                      space_type: newSpaceType,
                      calculation_method: newSpaceType === 'Flexplek' ? 'daily' : formData.calculation_method
                    });
                  }}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  disabled={!!editingRate}
                >
                  <option value="">Selecteer een type...</option>
                  {Object.entries(SPACE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">
                  Berekeningsmethode
                </label>
                <select
                  required
                  value={formData.calculation_method}
                  onChange={(e) => setFormData({ ...formData, calculation_method: e.target.value as any })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                  disabled={formData.space_type === 'Flexplek'}
                >
                  {formData.space_type === 'Flexplek' ? (
                    <option value="daily">Per dag (x dagen per maand)</option>
                  ) : (
                    Object.entries(CALCULATION_METHOD_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))
                  )}
                </select>
                {formData.space_type === 'Flexplek' && (
                  <p className="text-xs text-gray-400 mt-1">Flexplek gebruikt altijd de "per dag" berekeningsmethode</p>
                )}
              </div>

              {(formData.calculation_method === 'per_sqm' || formData.calculation_method === 'custom') && (
                <div className="space-y-3 p-4 bg-dark-900 rounded-lg">
                  <h4 className="text-sm font-bold text-gray-200">Prijs per m²</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Standaard</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          required={formData.calculation_method === 'per_sqm'}
                          value={formData.rate_per_sqm}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              setFormData({ ...formData, rate_per_sqm: value });
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                          placeholder="0.00"
                        />
                        <span className="text-gray-400">€/m²</span>
                      </div>
                    </div>
                    {formData.space_type === 'kantoor' && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Gemeubileerd</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.rate_per_sqm_furnished}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                setFormData({ ...formData, rate_per_sqm_furnished: value });
                              }
                            }}
                            className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                            placeholder="0.00"
                          />
                          <span className="text-gray-400">€/m²</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(formData.calculation_method === 'fixed_monthly' || formData.calculation_method === 'custom') && (
                <div className="space-y-3 p-4 bg-dark-900 rounded-lg">
                  <h4 className="text-sm font-bold text-gray-200">Vast Maandbedrag</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Standaard</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          required={formData.calculation_method === 'fixed_monthly'}
                          value={formData.fixed_rate}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              setFormData({ ...formData, fixed_rate: value });
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                          placeholder="0.00"
                        />
                        <span className="text-gray-400">€</span>
                      </div>
                    </div>
                    {formData.space_type === 'kantoor' && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Gemeubileerd</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.fixed_rate_furnished}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                setFormData({ ...formData, fixed_rate_furnished: value });
                              }
                            }}
                            className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                            placeholder="0.00"
                          />
                          <span className="text-gray-400">€</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formData.calculation_method === 'hourly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Prijs per Uur
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={formData.hourly_rate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          setFormData({ ...formData, hourly_rate: value });
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder="0.00"
                    />
                    <span className="text-gray-400">€/uur</span>
                  </div>
                </div>
              )}

              {formData.calculation_method === 'daily' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Prijs per Dag (Basis)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={formData.daily_rate}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setFormData({ ...formData, daily_rate: value });
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                        placeholder="0.00"
                      />
                      <span className="text-gray-400">€/dag</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Dit tarief wordt gebruikt voor flexplekken en vermenigvuldigd met het aantal gebruikte dagen
                    </p>
                  </div>
                  {formData.space_type === 'Flexplek' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-1">
                        Prijs per Dag (Gemeubileerd)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.daily_rate_furnished}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              setFormData({ ...formData, daily_rate_furnished: value });
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                          placeholder="0.00"
                        />
                        <span className="text-gray-400">€/dag</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Tarief voor gemeubileerde flexplekken (optioneel, laat leeg indien niet van toepassing)
                      </p>
                    </div>
                  )}
                </div>
              )}


              <div className="flex items-center gap-3 p-4 bg-dark-900 rounded-lg">
                <input
                  type="checkbox"
                  id="is_annual"
                  checked={formData.is_annual}
                  onChange={(e) => setFormData({ ...formData, is_annual: e.target.checked })}
                  className="w-4 h-4 text-gold-500 border-dark-600 rounded focus:ring-2 focus:ring-gold-500"
                />
                <label htmlFor="is_annual" className="text-sm text-gray-300">
                  Dit is een jaarlijks tarief (automatisch delen door 12 voor maandelijkse facturering)
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1">
                    Beschrijving (optioneel)
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                    placeholder="Bijvoorbeeld: Standaard kantoorruimte"
                  />
                </div>
                {(formData.space_type === 'kantoor' || formData.space_type === 'Flexplek') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-1">
                      Beschrijving Gemeubileerd (optioneel)
                    </label>
                    <input
                      type="text"
                      value={formData.description_furnished}
                      onChange={(e) => setFormData({ ...formData, description_furnished: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-700 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
                      placeholder={formData.space_type === 'kantoor' ? 'Bijvoorbeeld: Volledig gemeubileerd kantoor' : 'Bijvoorbeeld: Flexplek met bureau en stoel'}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-dark-600 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gold-500 text-dark-950 rounded-lg hover:bg-gold-600 transition-colors font-medium"
                >
                  {editingRate ? 'Opslaan' : 'Toevoegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-dark-900 rounded-lg border border-dark-700 p-4">
        <h4 className="text-sm font-bold text-gray-100 mb-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-gold-500" />
          Uitleg berekeningsmethoden
        </h4>
        <div className="space-y-2 text-xs text-gray-300">
          <p><strong className="text-gold-500">Per vierkante meter:</strong> De huurprijs wordt berekend op basis van het aantal m² × prijs per m²</p>
          <p><strong className="text-gold-500">Vast maandbedrag:</strong> Een vast bedrag per maand, onafhankelijk van grootte</p>
          <p><strong className="text-gold-500">Per uur:</strong> Prijs wordt berekend per uur gebruik (voor vergaderruimtes)</p>
          <p><strong className="text-gold-500">Per dag:</strong> Dagprijs × aantal gebruikte dagen (alleen voor flexplekken)</p>
          <p><strong className="text-gold-500">Aangepast:</strong> Combinatie van m²-prijs en vast bedrag mogelijk</p>
          <p className="pt-2 border-t border-dark-700"><strong className="text-gold-500">Bedrijfsruimte & Buitenterrein:</strong> Deze ruimtetypes hebben altijd een jaarlijks tarief dat automatisch gedeeld wordt door 12 voor maandelijkse facturering</p>
          <p><strong className="text-gold-500">Jaarlijks tarief:</strong> Wanneer aangevinkt wordt het opgegeven tarief automatisch gedeeld door 12 voor maandelijkse facturering</p>
          <p><strong className="text-gold-500">Gemeubileerd:</strong> Voor kantoren kun je aparte tarieven instellen voor gemeubileerde en niet-gemeubileerde ruimtes</p>
          <p><strong className="text-gold-500">Flexplek:</strong> Flexplekken gebruiken altijd de "per dag" berekeningsmethode</p>
        </div>
      </div>
    </div>
  );
}
