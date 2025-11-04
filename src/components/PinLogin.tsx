import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, AlertCircle } from 'lucide-react';

type Tenant = {
  id: string;
  name: string;
  company_name: string;
  booking_pin_code: string;
};

type PinLoginProps = {
  onAuthenticated: (tenantId: string, tenantName: string) => void;
};

export function PinLogin({ onAuthenticated }: PinLoginProps) {
  const [pinCode, setPinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPinCode(value);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pinCode.length !== 6) {
      setError('Voer een 6-cijferige PIN-code in');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name, company_name, booking_pin_code')
        .eq('booking_pin_code', pinCode);

      if (tenants && tenants.length > 0) {
        const tenant = tenants[0] as Tenant;
        onAuthenticated(tenant.id, tenant.company_name || tenant.name);
      } else {
        setError('Onjuiste PIN-code. Probeer opnieuw.');
        setPinCode('');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Er is een fout opgetreden. Probeer het later opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-600 rounded-full mb-4">
            <LogIn size={32} className="text-dark-900" />
          </div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">HAL5 Overloon</h1>
          <p className="text-gray-400">Vergaderruimte Boekingssysteem</p>
        </div>

        <div className="bg-dark-800 rounded-lg shadow-xl p-8 border border-dark-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-6 text-center">
            Log in met uw PIN-code
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="pinCode" className="block text-sm font-medium text-gray-300 mb-2">
                PIN-code
              </label>
              <input
                type="password"
                id="pinCode"
                value={pinCode}
                onChange={handlePinChange}
                className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-gray-100 text-center text-2xl tracking-widest focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                placeholder="••••••"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                autoFocus
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Voer uw 6-cijferige persoonlijke PIN-code in
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-2 text-red-300">
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pinCode.length !== 6 || loading}
              className="w-full bg-gold-600 text-dark-900 px-6 py-3 rounded-lg font-semibold hover:bg-gold-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Bezig met inloggen...' : 'Inloggen'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-700 text-center">
            <p className="text-xs text-gray-500">
              Neem contact op met de beheerder als u problemen heeft met inloggen
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
