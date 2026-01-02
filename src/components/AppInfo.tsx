import { useState, useEffect } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { Settings, Edit2, FolderOpen, RefreshCw, Info, Package } from 'lucide-react';

export function AppInfo() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  const [formData, setFormData] = useState({
    root_folder_path: '',
    test_mode: false,
    test_date: '',
  });

  useEffect(() => {
    fetchSettings();
    fetchAppVersion();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setLoading(false);
    }
  };

  const fetchAppVersion = async () => {
    try {
      if (window.electron?.getAppVersion) {
        const version = await window.electron.getAppVersion();
        setAppVersion(version);
      } else {
        const response = await fetch('/package.json');
        const packageJson = await response.json();
        setAppVersion(packageJson.version || '1.0.0');
      }
    } catch (error) {
      console.error('Error fetching app version:', error);
      setAppVersion('1.0.22');
    }
  };

  const handleEdit = () => {
    if (settings) {
      setFormData({
        root_folder_path: settings.root_folder_path || '',
        test_mode: settings.test_mode || false,
        test_date: settings.test_date || '',
      });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (settings) {
        const { error } = await supabase
          .from('company_settings')
          .update(formData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert([formData]);

        if (error) throw error;
      }

      await fetchSettings();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Er is een fout opgetreden bij het opslaan van de gegevens');
    }
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);

    try {
      if (window.electron?.checkForUpdates) {
        const result = await window.electron.checkForUpdates();
        if (result.available) {
          setUpdateMessage(`Update beschikbaar: v${result.version}`);
        } else {
          setUpdateMessage('Je gebruikt de nieuwste versie');
        }
      } else {
        setUpdateMessage('Update functie alleen beschikbaar in desktop versie');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      setUpdateMessage('Fout bij controleren van updates');
    } finally {
      setCheckingUpdate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-dark-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-dark-700">
            <div className="p-6 border-b border-dark-700">
              <h3 className="text-xl font-semibold text-gray-100">
                App Instellingen Bewerken
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Root Folder Path (voor PDF opslag)
                  </label>
                  <input
                    type="text"
                    value={formData.root_folder_path}
                    onChange={(e) => setFormData({ ...formData, root_folder_path: e.target.value })}
                    placeholder="bijv. C:\HAL5\Facturen"
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Geef het pad op waar PDF facturen opgeslagen moeten worden
                  </p>
                </div>

                <div className="border-t border-dark-700 pt-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.test_mode}
                      onChange={(e) => setFormData({ ...formData, test_mode: e.target.checked })}
                      className="w-4 h-4 bg-dark-800 border-dark-700 rounded"
                    />
                    Test Modus
                  </label>
                  <p className="text-xs text-gray-400 ml-6">
                    Schakel test modus in om met een gesimuleerde datum te werken
                  </p>
                </div>

                {formData.test_mode && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Test Datum
                    </label>
                    <input
                      type="date"
                      value={formData.test_date}
                      onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                      className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="bg-gold-500 text-white px-6 py-2 rounded-lg hover:bg-gold-600 transition-colors"
                >
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-semibold text-gray-100">App Gegevens</h3>
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 text-gold-500 hover:text-gold-400 transition-colors"
          >
            <Edit2 size={18} />
            Bewerken
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Applicatie Informatie</h4>
            <div className="bg-dark-800 rounded-lg p-4 border border-dark-700 space-y-3">
              <div className="flex items-start gap-3">
                <Package size={20} className="text-gold-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">Applicatie Naam</p>
                  <p className="text-sm text-gray-200 font-medium">HAL5 Facturatie Manager</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Info size={20} className="text-gold-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">Huidige Versie</p>
                  <p className="text-sm text-gray-200 font-mono">v{appVersion}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Software Updates</h4>
            <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
              <div className="flex items-start gap-3 mb-3">
                <RefreshCw size={20} className="text-gold-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-200 font-medium mb-1">Automatische Updates</p>
                  <p className="text-xs text-gray-400">
                    Controleer regelmatig of er nieuwe versies beschikbaar zijn
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleCheckForUpdates}
                  disabled={checkingUpdate}
                  className="flex items-center gap-2 bg-dark-700 text-gray-200 px-4 py-2 rounded-lg hover:bg-dark-600 transition-colors border border-dark-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={18} className={checkingUpdate ? 'animate-spin' : ''} />
                  {checkingUpdate ? 'Checken...' : 'Check voor Updates'}
                </button>
                {updateMessage && (
                  <p className="text-sm text-gray-300">{updateMessage}</p>
                )}
              </div>
            </div>
          </div>

          {settings?.root_folder_path && (
            <div>
              <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Opslag Locatie</h4>
              <div className="bg-dark-800 rounded-lg p-4 border border-dark-700">
                <div className="flex items-start gap-3">
                  <FolderOpen size={20} className="text-gold-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">Root folder voor PDF opslag</p>
                    <p className="text-sm text-gray-200 break-all font-mono">{settings.root_folder_path}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {settings?.test_mode && (
            <div>
              <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Test Modus</h4>
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Settings size={20} className="text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-yellow-200 text-sm font-medium mb-1">Test modus actief</p>
                    {settings.test_date ? (
                      <p className="text-gray-300 text-sm">
                        Gesimuleerde datum: {new Date(settings.test_date).toLocaleDateString('nl-NL', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    ) : (
                      <p className="text-gray-300 text-sm">
                        Test modus is actief (geen specifieke datum ingesteld)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!settings?.root_folder_path && !settings?.test_mode && (
            <div className="text-center py-8">
              <Settings size={48} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm text-gray-400 mb-2">Geen aanvullende instellingen geconfigureerd</p>
              <p className="text-xs text-gray-500">Klik op "Bewerken" om instellingen toe te voegen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
