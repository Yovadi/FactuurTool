import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, FileText, AlertTriangle, TrendingUp, Bell, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

type ActivityItem = {
  id: string;
  type: 'email' | 'notification';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ReactNode;
  color: string;
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Zojuist';
  if (minutes < 60) return `${minutes}m geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d geleden`;
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' });
}

function getNotificationIcon(type: string): { icon: React.ReactNode; color: string } {
  switch (type) {
    case 'lease_expiring_30':
      return { icon: <AlertTriangle size={14} />, color: 'text-red-400' };
    case 'lease_expiring_60':
      return { icon: <AlertTriangle size={14} />, color: 'text-amber-400' };
    case 'rent_indexation_applied':
      return { icon: <TrendingUp size={14} />, color: 'text-green-400' };
    case 'booking_cancelled':
      return { icon: <Bell size={14} />, color: 'text-red-400' };
    case 'booking_pending':
      return { icon: <Bell size={14} />, color: 'text-amber-400' };
    default:
      return { icon: <Bell size={14} />, color: 'text-gray-400' };
  }
}

export function ActivityLogPanel() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadActivities = async () => {
    const [emailsResult, notificationsResult, invoicesResult] = await Promise.all([
      supabase
        .from('email_logs')
        .select('id, to_email, to_name, subject, status, method, sent_at')
        .order('sent_at', { ascending: false })
        .limit(15),
      supabase
        .from('admin_notifications')
        .select('id, notification_type, title, message, created_at')
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('invoices')
        .select('id, invoice_number, status, amount, updated_at, tenants(company_name), external_customers(company_name)')
        .in('status', ['paid', 'sent', 'credited'])
        .order('updated_at', { ascending: false })
        .limit(10),
    ]);

    const items: ActivityItem[] = [];

    (emailsResult.data || []).forEach(email => {
      const statusLabel = email.status === 'sent' ? 'Verzonden' : email.status === 'failed' ? 'Mislukt' : 'Wacht';
      items.push({
        id: `email-${email.id}`,
        type: 'email',
        title: `E-mail ${statusLabel.toLowerCase()}`,
        description: `${email.subject} naar ${email.to_name || email.to_email}`,
        timestamp: email.sent_at,
        icon: <Mail size={14} />,
        color: email.status === 'sent' ? 'text-blue-400' : email.status === 'failed' ? 'text-red-400' : 'text-gray-400',
      });
    });

    (notificationsResult.data || []).forEach(notif => {
      const { icon, color } = getNotificationIcon(notif.notification_type);
      items.push({
        id: `notif-${notif.id}`,
        type: 'notification',
        title: notif.title,
        description: notif.message,
        timestamp: notif.created_at,
        icon,
        color,
      });
    });

    (invoicesResult.data || []).forEach(inv => {
      const customer = (inv.tenants as any)?.company_name || (inv.external_customers as any)?.company_name || '';
      const statusLabel = inv.status === 'paid' ? 'Betaald' : inv.status === 'credited' ? 'Gecrediteerd' : 'Verzonden';
      const statusColor = inv.status === 'paid' ? 'text-green-400' : inv.status === 'credited' ? 'text-teal-400' : 'text-amber-400';
      const statusIcon = inv.status === 'paid' ? <CheckCircle size={14} /> : <FileText size={14} />;

      items.push({
        id: `inv-${inv.id}`,
        type: 'notification',
        title: `Factuur ${inv.invoice_number} ${statusLabel.toLowerCase()}`,
        description: customer ? `${customer} - \u20AC${inv.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}` : '',
        timestamp: inv.updated_at,
        icon: statusIcon,
        color: statusColor,
      });
    });

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setActivities(items.slice(0, 30));
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-gold-500" size={24} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-700 flex-shrink-0 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">Activiteitenlogboek</h3>
          <p className="text-xs text-gray-500 mt-0.5">Recente acties en meldingen</p>
        </div>
        <button
          onClick={() => { setLoading(true); loadActivities(); }}
          className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-dark-800"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Bell size={28} className="mb-2 opacity-40" />
            <p className="text-sm">Nog geen activiteiten</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-800">
            {activities.map((item) => (
              <div key={item.id} className="px-4 py-3 hover:bg-dark-800/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-200 truncate">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 flex-shrink-0 whitespace-nowrap">
                    {formatTimeAgo(item.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
