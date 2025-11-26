import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, AlertCircle, Calculator } from 'lucide-react';

type SpaceTypeRate = {
  id: string;
  space_type: string;
  rate_per_sqm: number;
  rate_per_sqm_furnished: number;
  calculation_method: 'per_sqm' | 'fixed_monthly' | 'hourly' | 'custom';
  fixed_rate: number;
  fixed_rate_furnished: number;
  hourly_rate: number;
  is_annual: boolean;
  description: string;
  description_furnished: string;
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
        rate_per_sqm_furnished: rate.rate_per_sqm_furnished,
        calculation_method: rate.calculation_method,
        fixed_rate: rate.fixed_rate,
        fixed_rate_furnished: rate.fixed_rate_furnished,
        hourly_rate: rate.hourly_rate,
        is_annual: rate.is_annual,
        description: rate.description,
        description_furnished: rate.description_furnished
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
    <div className="space-y-3">
      {successMessage && (
        <div className="bg-emerald-900 border border-emerald-700 text-emerald-100 px-3 py-2 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle size={16} />
          {successMessage}
        </div>
      )}

      <div className="bg-dark-900 rounded-lg border border-dark-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-700 bg-dark-800">
                <th className="text-left py-2 px-3 text-gray-300 font-semibold">Ruimtetype</th>
                <th className="text-left py-2 px-3 text-gray-300 font-semibold">Methode</th>
                <th className="text-center py-2 px-3 text-gray-300 font-semibold">Prijs/m²</th>
                <th className="text-center py-2 px-3 text-gray-300 font-semibold">Gem. /m²</th>
                <th className="text-center py-2 px-3 text-gray-300 font-semibold">Vast bedrag</th>
                <th className="text-center py-2 px-3 text-gray-300 font-semibold">Gem. vast</th>
                <th className="text-center py-2 px-3 text-gray-300 font-semibold">Uurprijs</th>
                <th className="text-center py-2 px-3 text-gray-300 font-semibold">Jaarlijks</th>
                <th className="text-left py-2 px-3 text-gray-300 font-semibold">Beschrijving</th>
                <th className="text-left py-2 px-3 text-gray-300 font-semibold">Gem. beschr.</th>
                <th className="text-center py-2 px-3 text-gray-300 font-semibold">Acties</th>
              </tr>
            </thead>
            <tbody>
              {rates.map(rate => (
                <tr key={rate.id} className="border-b border-dark-700/50 hover:bg-dark-800/50">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <Calculator className="text-gold-500" size={14} />
                      <span className="font-medium text-gray-100">
                        {SPACE_TYPE_LABELS[rate.space_type] || rate.space_type}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={rate.calculation_method}
                      onChange={(e) => updateRate(rate.id, 'calculation_method', e.target.value)}
                      className="w-32 px-2 py-1 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                    >
                      {Object.entries(CALCULATION_METHOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    {(rate.calculation_method === 'per_sqm' || rate.calculation_method === 'custom') && (
                      <input
                        type="number"
                        step="0.01"
                        value={rate.rate_per_sqm}
                        onChange={(e) => updateRate(rate.id, 'rate_per_sqm', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 text-center focus:ring-1 focus:ring-gold-500"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {rate.space_type === 'kantoor' && (rate.calculation_method === 'per_sqm' || rate.calculation_method === 'custom') && (
                      <input
                        type="number"
                        step="0.01"
                        value={rate.rate_per_sqm_furnished}
                        onChange={(e) => updateRate(rate.id, 'rate_per_sqm_furnished', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 text-center focus:ring-1 focus:ring-gold-500"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {(rate.calculation_method === 'fixed_monthly' || rate.calculation_method === 'custom') && (
                      <input
                        type="number"
                        step="0.01"
                        value={rate.fixed_rate}
                        onChange={(e) => updateRate(rate.id, 'fixed_rate', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 text-center focus:ring-1 focus:ring-gold-500"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {rate.space_type === 'kantoor' && (rate.calculation_method === 'fixed_monthly' || rate.calculation_method === 'custom') && (
                      <input
                        type="number"
                        step="0.01"
                        value={rate.fixed_rate_furnished}
                        onChange={(e) => updateRate(rate.id, 'fixed_rate_furnished', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 text-center focus:ring-1 focus:ring-gold-500"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {rate.calculation_method === 'hourly' && (
                      <input
                        type="number"
                        step="0.01"
                        value={rate.hourly_rate}
                        onChange={(e) => updateRate(rate.id, 'hourly_rate', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 text-center focus:ring-1 focus:ring-gold-500"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="checkbox"
                      id={`is_annual_${rate.id}`}
                      checked={rate.is_annual}
                      onChange={(e) => updateRate(rate.id, 'is_annual', e.target.checked)}
                      className="w-4 h-4 text-gold-500 border-dark-600 rounded focus:ring-1 focus:ring-gold-500"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={rate.description || ''}
                      onChange={(e) => updateRate(rate.id, 'description', e.target.value)}
                      className="w-32 px-2 py-1 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                      placeholder="Optioneel"
                    />
                  </td>
                  <td className="py-2 px-3">
                    {rate.space_type === 'kantoor' && (
                      <input
                        type="text"
                        value={rate.description_furnished || ''}
                        onChange={(e) => updateRate(rate.id, 'description_furnished', e.target.value)}
                        className="w-32 px-2 py-1 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                        placeholder="Optioneel"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => saveRate(rate)}
                      disabled={saving === rate.id}
                      className="inline-flex items-center gap-1 bg-gold-500 text-dark-950 px-2 py-1 rounded hover:bg-gold-600 transition-colors disabled:opacity-50 text-xs font-medium"
                    >
                      <Save size={12} />
                      {saving === rate.id ? 'Bezig...' : 'Opslaan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-dark-900 rounded-lg border border-dark-700 p-3">
        <h4 className="text-sm font-bold text-gray-100 mb-2">Uitleg berekeningsmethoden</h4>
        <div className="space-y-1 text-xs text-gray-300">
          <p><strong className="text-gold-500">Per vierkante meter:</strong> De huurprijs wordt berekend op basis van het aantal m² × prijs per m²</p>
          <p><strong className="text-gold-500">Vast maandbedrag:</strong> Een vast bedrag per maand, onafhankelijk van grootte</p>
          <p><strong className="text-gold-500">Per uur:</strong> Prijs wordt berekend per uur gebruik (voor vergaderruimtes)</p>
          <p><strong className="text-gold-500">Aangepast:</strong> Combinatie van m²-prijs en vast bedrag mogelijk</p>
          <p className="pt-1 border-t border-dark-700 mt-1"><strong className="text-gold-500">Jaarlijks tarief:</strong> Wanneer aangevinkt wordt het opgegeven tarief automatisch gedeeld door 12 voor maandelijkse facturering</p>
          <p><strong className="text-gold-500">Gemeubileerd:</strong> Voor kantoren kun je aparte tarieven instellen voor gemeubileerde en niet-gemeubileerde ruimtes</p>
        </div>
      </div>
    </div>
  );
}
