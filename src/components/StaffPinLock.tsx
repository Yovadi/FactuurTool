import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase';
import { requestGate, roleFromAccessToken, staffLockDecision } from '../utils/accessGate';

const STORAGE_KEY = 'hal5-staff-unlocked';

async function readStaffPin(): Promise<{ visible: boolean; pin: string | null }> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('staff_pin_code')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { visible: false, pin: null };
  return { visible: true, pin: (data.staff_pin_code || '').trim() || null };
}

export function StaffPinLock({ children }: { children: React.ReactNode }) {
  const [requiredPin, setRequiredPin] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pinCheckFailed, setPinCheckFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token && roleFromAccessToken(token) === 'staff') {
        if (!cancelled) {
          setUnlocked(true);
          setLoading(false);
        }
        return;
      }
      try {
        const { visible, pin } = await readStaffPin();
        if (cancelled) return;
        const decision = staffLockDecision({
          hasStaffSession: false,
          settingsVisible: visible,
          pin,
          remembered: sessionStorage.getItem(STORAGE_KEY) === '1',
        });
        setRequiredPin(visible ? pin : 'server');
        setUnlocked(decision === 'open');
        setLoading(false);
      } catch {
        if (cancelled) return;
        setRequiredPin('server');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center text-gray-400">
        Laden...
      </div>
    );
  }

  if (pinCheckFailed) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-dark-900 border border-dark-700 rounded-2xl p-6 space-y-4">
          <h1 className="text-xl font-semibold text-gray-100">HAL5 Facturatie</h1>
          <p className="text-sm text-gray-400">De PIN kon niet worden gecontroleerd. Probeer het opnieuw.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full bg-gold-500 text-dark-950 font-medium py-2.5 rounded-lg hover:bg-gold-400"
          >
            Opnieuw
          </button>
        </div>
      </div>
    );
  }

  if (!unlocked && requiredPin) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabaseUrl || !supabaseAnonKey) {
              setError('De verbinding ontbreekt.');
              return;
            }
            setChecking(true);
            const gate = await requestGate(supabaseUrl, supabaseAnonKey, 'staff-session', input);
            if (gate.kind === 'session' && gate.accessToken && gate.refreshToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: gate.accessToken,
                refresh_token: gate.refreshToken,
              });
              setChecking(false);
              if (sessionError || roleFromAccessToken(gate.accessToken) !== 'staff') {
                setError('De PIN is niet bevestigd.');
                setInput('');
                return;
              }
              sessionStorage.setItem(STORAGE_KEY, '1');
              setUnlocked(true);
              setError('');
              return;
            }
            setChecking(false);
            if (gate.kind === 'rejected') {
              setError(gate.message || 'Onjuiste personeels-PIN');
              setInput('');
              return;
            }
            if (gate.kind === 'legacy' && requiredPin && requiredPin !== 'server' && input === requiredPin) {
              sessionStorage.setItem(STORAGE_KEY, '1');
              setUnlocked(true);
              setError('');
              return;
            }
            if (gate.kind === 'legacy' && requiredPin === 'server') {
              setPinCheckFailed(true);
              return;
            }
            setError(gate.kind === 'legacy' ? 'Onjuiste personeels-PIN' : 'De PIN kon niet worden gecontroleerd. Probeer het opnieuw.');
            setInput('');
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
          <button type="submit" disabled={checking} className="w-full bg-gold-500 text-dark-950 font-medium py-2.5 rounded-lg hover:bg-gold-400 disabled:opacity-60">
            {checking ? 'Controleren...' : 'Ontgrendelen'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
