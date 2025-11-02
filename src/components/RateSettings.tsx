import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Save, AlertCircle } from 'lucide-react';

type Space = {
  id: string;
  space_number: string;
  space_type: string;
  hourly_rate?: number;
};

type Notification = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
};

export function RateSettings() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationId, setNotificationId] = useState(0);

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('office_spaces')
      .select('id, space_number, space_type, hourly_rate')
      .eq('space_type', 'Meeting Room')
      .order('space_number');

    setSpaces(data || []);
    setLoading(false);
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = notificationId;
    setNotificationId(id + 1);
    setNotifications(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const handleRateUpdate = async (spaceId: string, newRate: number) => {
    const { error } = await supabase
      .from('office_spaces')
      .update({ hourly_rate: newRate })
      .eq('id', spaceId);

    if (error) {
      console.error('Error updating rate:', error.message);
      showNotification('Fout bij het bijwerken van het tarief.', 'error');
      return;
    }

    showNotification('Tarief succesvol bijgewerkt!', 'success');
    setSpaces(spaces.map(s => s.id === spaceId ? { ...s, hourly_rate: newRate } : s));
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-300">Tarieven laden...</div>;
  }

  return (
    <div>
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border backdrop-blur-sm animate-slide-in ${
              notification.type === 'success'
                ? 'bg-green-900/90 border-green-700 text-green-100'
                : notification.type === 'error'
                ? 'bg-red-900/90 border-red-700 text-red-100'
                : 'bg-blue-900/90 border-blue-700 text-blue-100'
            }`}
          >
            {notification.type === 'success' && <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />}
            {notification.type === 'error' && <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />}
            {notification.type === 'info' && <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />}
            <p className="text-sm font-medium flex-1">{notification.message}</p>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Tarieven Beheren</h1>
        <p className="text-gray-300">Beheer de uurtarieven voor vergaderruimtes</p>
      </div>

      <div className="bg-dark-900 rounded-lg shadow-sm border border-dark-700 p-6">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="text-gold-500" size={24} />
          <h2 className="text-xl font-semibold text-gray-100">Vergaderruimte Tarieven</h2>
        </div>

        <div className="space-y-4">
          {spaces.length === 0 ? (
            <p className="text-center py-8 text-gray-400">Geen vergaderruimtes gevonden</p>
          ) : (
            spaces.map((space) => (
              <div
                key={space.id}
                className="flex items-center justify-between p-4 bg-dark-800 rounded-lg border border-dark-700 hover:border-gold-600 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-100">{space.space_number}</h3>
                  <p className="text-sm text-gray-400">Vergaderruimte</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-300">€</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={space.hourly_rate || 25}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setSpaces(spaces.map(s => s.id === space.id ? { ...s, hourly_rate: value } : s));
                      }}
                      className="w-24 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                    />
                    <span className="text-sm text-gray-300">/uur</span>
                  </div>

                  <button
                    onClick={() => handleRateUpdate(space.id, space.hourly_rate || 25)}
                    className="bg-gold-600 text-white px-4 py-2 rounded-lg hover:bg-gold-700 transition-colors flex items-center gap-2"
                  >
                    <Save size={18} />
                    Opslaan
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-blue-300">
              <p className="font-medium mb-1">Let op:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Deze tarieven zijn van toepassing op nieuwe boekingen</li>
                <li>Bestaande boekingen behouden hun originele tarief</li>
                <li>Tarieven zijn zichtbaar op de publieke boekingspagina</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
