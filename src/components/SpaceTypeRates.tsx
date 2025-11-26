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

      <div className="grid gap-3">
        {rates.map(rate => (
          <div key={rate.id} className="bg-dark-900 rounded-lg border border-dark-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-dark-800 border-b border-dark-700">
              <div className="flex items-center gap-2">
                <Calculator className="text-gold-500" size={16} />
                <h3 className="text-sm font-bold text-gray-100">
                  {SPACE_TYPE_LABELS[rate.space_type] || rate.space_type}
                </h3>
              </div>
              <button
                onClick={() => saveRate(rate)}
                disabled={saving === rate.id}
                className="flex items-center gap-1.5 bg-gold-500 text-dark-950 px-2.5 py-1.5 rounded hover:bg-gold-600 transition-colors disabled:opacity-50 text-xs font-medium"
              >
                <Save size={12} />
                {saving === rate.id ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>

            <div className="p-4">
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-dark-700">
                    <td className="py-2.5 pr-4 text-gray-400 font-medium w-48">Berekeningsmethode</td>
                    <td className="py-2.5">
                      <select
                        value={rate.calculation_method}
                        onChange={(e) => updateRate(rate.id, 'calculation_method', e.target.value)}
                        className="w-full max-w-xs px-2.5 py-1.5 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                      >
                        {Object.entries(CALCULATION_METHOD_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>

                  {(rate.calculation_method === 'per_sqm' || rate.calculation_method === 'custom') && (
                    <tr className="border-b border-dark-700">
                      <td className="py-2.5 pr-4 text-gray-400 font-medium">Prijs per m²</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">Standaard:</span>
                            <input
                              type="number"
                              step="0.01"
                              value={rate.rate_per_sqm}
                              onChange={(e) => updateRate(rate.id, 'rate_per_sqm', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2.5 py-1.5 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                            />
                            <span className="text-gray-400">€/m²</span>
                          </div>
                          {rate.space_type === 'kantoor' && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-xs">Gemeubileerd:</span>
                              <input
                                type="number"
                                step="0.01"
                                value={rate.rate_per_sqm_furnished}
                                onChange={(e) => updateRate(rate.id, 'rate_per_sqm_furnished', parseFloat(e.target.value) || 0)}
                                className="w-24 px-2.5 py-1.5 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                              />
                              <span className="text-gray-400">€/m²</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {(rate.calculation_method === 'fixed_monthly' || rate.calculation_method === 'custom') && (
                    <tr className="border-b border-dark-700">
                      <td className="py-2.5 pr-4 text-gray-400 font-medium">Vast bedrag</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">Standaard:</span>
                            <input
                              type="number"
                              step="0.01"
                              value={rate.fixed_rate}
                              onChange={(e) => updateRate(rate.id, 'fixed_rate', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2.5 py-1.5 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                            />
                            <span className="text-gray-400">€</span>
                          </div>
                          {rate.space_type === 'kantoor' && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-xs">Gemeubileerd:</span>
                              <input
                                type="number"
                                step="0.01"
                                value={rate.fixed_rate_furnished}
                                onChange={(e) => updateRate(rate.id, 'fixed_rate_furnished', parseFloat(e.target.value) || 0)}
                                className="w-24 px-2.5 py-1.5 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                              />
                              <span className="text-gray-400">€</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {rate.calculation_method === 'hourly' && (
                    <tr className="border-b border-dark-700">
                      <td className="py-2.5 pr-4 text-gray-400 font-medium">Prijs per uur</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={rate.hourly_rate}
                            onChange={(e) => updateRate(rate.id, 'hourly_rate', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2.5 py-1.5 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                          />
                          <span className="text-gray-400">€/uur</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  <tr className="border-b border-dark-700">
                    <td className="py-2.5 pr-4 text-gray-400 font-medium">Jaarlijks tarief</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`is_annual_${rate.id}`}
                          checked={rate.is_annual}
                          onChange={(e) => updateRate(rate.id, 'is_annual', e.target.checked)}
                          className="w-4 h-4 text-gold-500 border-dark-600 rounded focus:ring-1 focus:ring-gold-500"
                        />
                        <label htmlFor={`is_annual_${rate.id}`} className="text-xs text-gray-400">
                          Automatisch delen door 12 voor maandelijkse facturering
                        </label>
                      </div>
                    </td>
                  </tr>

                  <tr className="border-b border-dark-700">
                    <td className="py-2.5 pr-4 text-gray-400 font-medium align-top pt-3">Beschrijving</td>
                    <td className="py-2.5">
                      <div className="space-y-2">
                        <div>
                          <span className="text-gray-400 text-xs block mb-1">Standaard:</span>
                          <input
                            type="text"
                            value={rate.description || ''}
                            onChange={(e) => updateRate(rate.id, 'description', e.target.value)}
                            className="w-full max-w-md px-2.5 py-1.5 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                            placeholder="Optioneel"
                          />
                        </div>
                        {rate.space_type === 'kantoor' && (
                          <div>
                            <span className="text-gray-400 text-xs block mb-1">Gemeubileerd:</span>
                            <input
                              type="text"
                              value={rate.description_furnished || ''}
                              onChange={(e) => updateRate(rate.id, 'description_furnished', e.target.value)}
                              className="w-full max-w-md px-2.5 py-1.5 text-xs bg-dark-800 border border-dark-600 rounded text-gray-100 focus:ring-1 focus:ring-gold-500"
                              placeholder="Optioneel"
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
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
