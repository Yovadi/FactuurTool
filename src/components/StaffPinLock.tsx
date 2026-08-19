import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'hal5-staff-unlocked';

export function StaffPinLock({ children }: { children: React.ReactNode }) {
  const [requiredPin, setRequiredPin] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('company_settings')
      .select('staff_pin_code')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const pin = (data?.staff_pin_code || '').trim();
        setRequiredPin(pin || null);
        if (!pin) {
          setUnlocked(true);
        } else if (sessionStorage.getItem(STORAGE_KEY) === '1') {
          setUnlocked(true);
        }
        setLoading(false);
      }, () => {
        setUnlocked(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center text-gray-400">
        Laden...
      </div>
    );
  }

  if (!unlocked && requiredPin) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input === requiredPin) {
              sessionStorage.setItem(STORAGE_KEY, '1');
              setUnlocked(true);
              setError('');
            } else {
              setError('Onjuiste personeels-PIN');
              setInput('');
            }
          }}
          className="w-full max-w-sm bg-dark-900 border border-dark-700 rounded-2xl p-6 space-y-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gold-500/10 flex items-center justify-center">
            <Lock className="text-gold-500" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-100">HAL5 Facturatie</h1>
            <p className="text-sm text-gray-400 mt-1">Voer de personeels-PIN in om de app te openen.</p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
            className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 tracking-widest"
            placeholder="PIN"
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="w-full bg-gold-500 text-dark-950 font-medium py-2.5 rounded-lg hover:bg-gold-400">
            Ontgrendelen
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
