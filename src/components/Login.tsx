import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, Lock, Building2 } from 'lucide-react';

type Tenant = {
  id: string;
  name: string;
  company_name: string;
  booking_pin_code: string | null;
};

type LoginProps = {
  onLogin: (tenantId: string, isAdmin: boolean) => void;
};

export function Login({ onLogin }: LoginProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [pin, setPin] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');

  useEffect(() => {
    loadTenants();
    loadDeleteCode();
  }, []);

  const loadTenants = async () => {
    const { data } = await supabase
      .from('tenants')
      .select('id, name, company_name, booking_pin_code')
      .order('company_name');

    setTenants(data || []);
    setLoading(false);
  };

  const loadDeleteCode = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('delete_code')
      .single();

    setDeleteCode(data?.delete_code || '');
  };

  const handleTenantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedTenant) {
      setError('Selecteer een huurder');
      return;
    }

    if (!pin) {
      setError('Voer je PIN code in');
      return;
    }

    const tenant = tenants.find(t => t.id === selectedTenant);

    if (!tenant) {
      setError('Huurder niet gevonden');
      return;
    }

    if (!tenant.booking_pin_code) {
      setError('Deze huurder heeft nog geen PIN code. Neem contact op met de beheerder.');
      return;
    }

    if (tenant.booking_pin_code !== pin) {
      setError('Onjuiste PIN code');
      return;
    }

    onLogin(selectedTenant, false);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!adminCode) {
      setError('Voer de admin code in');
      return;
    }

    if (adminCode !== deleteCode) {
      setError('Onjuiste admin code');
      return;
    }

    onLogin('admin', true);
  };

  if (loading) {
    return <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <p className="text-gray-300">Laden...</p>
    </div>;
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">HAL5 Facturatie</h1>
          <p className="text-gray-400">Log in om door te gaan</p>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-lg border border-dark-700 p-8">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsAdminLogin(false)}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                !isAdminLogin
                  ? 'bg-gold-600 text-white'
                  : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
              }`}
            >
              <Building2 className="inline mr-2" size={18} />
              Huurder
            </button>
            <button
              onClick={() => setIsAdminLogin(true)}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                isAdminLogin
                  ? 'bg-gold-600 text-white'
                  : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
              }`}
            >
              <Lock className="inline mr-2" size={18} />
              Beheerder
            </button>
          </div>

          {!isAdminLogin ? (
            <form onSubmit={handleTenantLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Selecteer je bedrijf
                </label>
                <select
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="w-full px-4 py-3 border border-dark-600 rounded-lg bg-dark-800 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  required
                >
                  <option value="">Kies een bedrijf...</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.company_name || tenant.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  PIN Code
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={4}
                  placeholder="••••"
                  className="w-full px-4 py-3 border border-dark-600 rounded-lg bg-dark-800 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent text-center text-2xl tracking-widest"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <LogIn size={20} />
                Inloggen
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Beheerder Code
                </label>
                <input
                  type="password"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="Voer admin code in"
                  className="w-full px-4 py-3 border border-dark-600 rounded-lg bg-dark-800 text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gold-600 text-white rounded-lg hover:bg-gold-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Lock size={20} />
                Inloggen als Beheerder
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-dark-700 text-center text-sm text-gray-400">
            <p>Neem contact op met de beheerder als je geen toegang hebt</p>
          </div>
        </div>
      </div>
    </div>
  );
}
