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
          <div key={rate.id} className="bg-dark-900 rounded-lg border border-dark-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calculator className="text-gold-500" size={18} />
                <h3 className="text-base font-bold text-gray-100">
                  {SPACE_TYPE_LABELS[rate.space_type] || rate.space_type}
                </h3>
              </div>
              <button
                onClick={() => saveRate(rate)}
                disabled={saving === rate.id}
                className="flex items-center gap-1.5 bg-gold-500 text-dark-950 px-3 py-1.5 rounded-lg hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Save size={14} />
                {saving === rate.id ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Berekeningsmethode
                </label>
                <select
                  value={rate.calculation_method}
                  onChange={(e) => updateRate(rate.id, 'calculation_method', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                >
                  {Object.entries(CALCULATION_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`is_annual_${rate.id}`}
                  checked={rate.is_annual}
                  onChange={(e) => updateRate(rate.id, 'is_annual', e.target.checked)}
                  className="w-4 h-4 text-gold-500 border-dark-600 rounded focus:ring-2 focus:ring-gold-500"
                />
                <label htmlFor={`is_annual_${rate.id}`} className="text-sm font-medium text-gray-300">
                  Tarief is jaarlijks (delen door 12)
                </label>
              </div>
            </div>

            {/* Standaard tarieven */}
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500"></span>
                Standaard Tarieven
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                {rate.calculation_method === 'per_sqm' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      Prijs per m² (€) {rate.is_annual && '(per jaar)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={rate.rate_per_sqm}
                      onChange={(e) => updateRate(rate.id, 'rate_per_sqm', parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    />
                    {rate.is_annual && rate.rate_per_sqm > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Per maand: €{(rate.rate_per_sqm / 12).toFixed(2)}/m²
                      </p>
                    )}
                  </div>
                )}

                {rate.calculation_method === 'fixed_monthly' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      Vast {rate.is_annual ? 'jaarbedrag' : 'maandbedrag'} (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={rate.fixed_rate}
                      onChange={(e) => updateRate(rate.id, 'fixed_rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    />
                    {rate.is_annual && rate.fixed_rate > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Per maand: €{(rate.fixed_rate / 12).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                {rate.calculation_method === 'hourly' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      Prijs per uur (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={rate.hourly_rate}
                      onChange={(e) => updateRate(rate.id, 'hourly_rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    />
                  </div>
                )}

                {rate.calculation_method === 'custom' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Prijs per m² (€) {rate.is_annual && '(per jaar)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={rate.rate_per_sqm}
                        onChange={(e) => updateRate(rate.id, 'rate_per_sqm', parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Vast bedrag (€) {rate.is_annual && '(per jaar)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={rate.fixed_rate}
                        onChange={(e) => updateRate(rate.id, 'fixed_rate', parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Beschrijving
                </label>
                <textarea
                  value={rate.description || ''}
                  onChange={(e) => updateRate(rate.id, 'description', e.target.value)}
                  rows={1}
                  className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  placeholder="Optionele beschrijving voor dit tarief"
                />
              </div>
            </div>

            {/* Gemeubileerde tarieven (alleen voor kantoren) */}
            {rate.space_type === 'kantoor' && (
              <div className="mb-3 border-t border-dark-700 pt-3">
                <h4 className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-500"></span>
                  Gemeubileerd Tarieven
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                  {rate.calculation_method === 'per_sqm' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Prijs per m² gemeubileerd (€) {rate.is_annual && '(per jaar)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={rate.rate_per_sqm_furnished}
                        onChange={(e) => updateRate(rate.id, 'rate_per_sqm_furnished', parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                      />
                      {rate.is_annual && rate.rate_per_sqm_furnished > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Per maand: €{(rate.rate_per_sqm_furnished / 12).toFixed(2)}/m²
                        </p>
                      )}
                    </div>
                  )}

                  {(rate.calculation_method === 'fixed_monthly' || rate.calculation_method === 'custom') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Vast bedrag gemeubileerd (€) {rate.is_annual && '(per jaar)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={rate.fixed_rate_furnished}
                        onChange={(e) => updateRate(rate.id, 'fixed_rate_furnished', parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                      />
                      {rate.is_annual && rate.fixed_rate_furnished > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Per maand: €{(rate.fixed_rate_furnished / 12).toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}

                  {rate.calculation_method === 'custom' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1.5">
                        Prijs per m² gemeubileerd (€) {rate.is_annual && '(per jaar)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={rate.rate_per_sqm_furnished}
                        onChange={(e) => updateRate(rate.id, 'rate_per_sqm_furnished', parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Beschrijving gemeubileerd
                  </label>
                  <textarea
                    value={rate.description_furnished || ''}
                    onChange={(e) => updateRate(rate.id, 'description_furnished', e.target.value)}
                    rows={1}
                    className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    placeholder="Optionele beschrijving voor gemeubileerd tarief"
                  />
                </div>
              </div>
            )}

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
