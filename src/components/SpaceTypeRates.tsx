import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, AlertCircle, Calculator } from 'lucide-react';

type SpaceTypeRate = {
  id: string;
  space_type: string;
  rate_per_sqm: number;
  calculation_method: 'per_sqm' | 'fixed_monthly' | 'hourly' | 'custom';
  fixed_rate: number;
  hourly_rate: number;
  description: string;
};

const SPACE_TYPE_LABELS: Record<string, string> = {
  'bedrijfsruimte': 'Bedrijfsruimte',
  'kantoor': 'Kantoor',
  'buitenterrein': 'Buitenterrein',
  'diversen': 'Diversen',
  'Meeting Room': 'Vergaderruimte'
};

const CALCULATION_METHOD_LABELS: Record<string, string> = {
  'per_sqm': 'Per vierkante meter',
  'fixed_monthly': 'Vast maandbedrag',
  'hourly': 'Per uur',
  'custom': 'Aangepast'
};

export function SpaceTypeRates() {
  const [rates, setRates] = useState<SpaceTypeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const updateRate = async (id: string, field: keyof SpaceTypeRate, value: any) => {
    const updatedRates = rates.map(rate =>
      rate.id === id ? { ...rate, [field]: value } : rate
    );
    setRates(updatedRates);
  };

  const saveRate = async (rate: SpaceTypeRate) => {
    setSaving(rate.id);
    const { error } = await supabase
      .from('space_type_rates')
      .update({
        rate_per_sqm: rate.rate_per_sqm,
        calculation_method: rate.calculation_method,
        fixed_rate: rate.fixed_rate,
        hourly_rate: rate.hourly_rate,
        description: rate.description
      })
      .eq('id', rate.id);

    if (error) {
      console.error('Error saving rate:', error);
      setSaving(null);
      return;
    }

    setSaving(null);
    setSuccessMessage(`Tarief voor ${SPACE_TYPE_LABELS[rate.space_type]} opgeslagen`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="bg-emerald-900 border border-emerald-700 text-emerald-100 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {successMessage}
        </div>
      )}

      <div className="grid gap-6">
        {rates.map(rate => (
          <div key={rate.id} className="bg-dark-900 rounded-lg border border-dark-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Calculator className="text-gold-500" size={24} />
              <h3 className="text-xl font-bold text-gray-100">
                {SPACE_TYPE_LABELS[rate.space_type] || rate.space_type}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Berekeningsmethode
                </label>
                <select
                  value={rate.calculation_method}
                  onChange={(e) => updateRate(rate.id, 'calculation_method', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                >
                  {Object.entries(CALCULATION_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {rate.calculation_method === 'per_sqm' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prijs per m² (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rate.rate_per_sqm}
                    onChange={(e) => updateRate(rate.id, 'rate_per_sqm', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>
              )}

              {rate.calculation_method === 'fixed_monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Vast maandbedrag (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rate.fixed_rate}
                    onChange={(e) => updateRate(rate.id, 'fixed_rate', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>
              )}

              {rate.calculation_method === 'hourly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Prijs per uur (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rate.hourly_rate}
                    onChange={(e) => updateRate(rate.id, 'hourly_rate', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>
              )}

              {rate.calculation_method === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Prijs per m² (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={rate.rate_per_sqm}
                      onChange={(e) => updateRate(rate.id, 'rate_per_sqm', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Vast bedrag (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={rate.fixed_rate}
                      onChange={(e) => updateRate(rate.id, 'fixed_rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Beschrijving
              </label>
              <textarea
                value={rate.description || ''}
                onChange={(e) => updateRate(rate.id, 'description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                placeholder="Optionele beschrijving voor dit tarief"
              />
            </div>

            <button
              onClick={() => saveRate(rate)}
              disabled={saving === rate.id}
              className="flex items-center gap-2 bg-gold-500 text-dark-950 px-4 py-2 rounded-lg hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {saving === rate.id ? 'Bezig met opslaan...' : 'Opslaan'}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-dark-900 rounded-lg border border-dark-700 p-6">
        <h4 className="text-lg font-bold text-gray-100 mb-3">Uitleg berekeningsmethoden</h4>
        <div className="space-y-2 text-sm text-gray-300">
          <p><strong className="text-gold-500">Per vierkante meter:</strong> De huurprijs wordt berekend op basis van het aantal m² × prijs per m²</p>
          <p><strong className="text-gold-500">Vast maandbedrag:</strong> Een vast bedrag per maand, onafhankelijk van grootte</p>
          <p><strong className="text-gold-500">Per uur:</strong> Prijs wordt berekend per uur gebruik (voor vergaderruimtes)</p>
          <p><strong className="text-gold-500">Aangepast:</strong> Combinatie van m²-prijs en vast bedrag mogelijk</p>
        </div>
      </div>
    </div>
  );
}
