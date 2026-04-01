import { useState, useEffect } from 'react';
import { loadEmailLogs, type EmailLog } from '../utils/emailSender';
import { Mail, CheckCircle2, XCircle, Clock, RefreshCw, Loader2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Pagination } from './Pagination';

type Props = {
  refreshTrigger?: number;
};

export function EmailSentItems({ refreshTrigger }: Props) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    fetchLogs();
  }, [refreshTrigger]);

  const fetchLogs = async () => {
    setLoading(true);
    const data = await loadEmailLogs(500);
    setLogs(data);
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.to_email.toLowerCase().includes(q) ||
      log.to_name.toLowerCase().includes(q) ||
      log.subject.toLowerCase().includes(q)
    );
  });

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Zojuist';
    if (minutes < 60) return `${minutes} min geleden`;
    if (hours < 24) return `${hours} uur geleden`;

    return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const statusConfig = {
    sent: { icon: CheckCircle2, label: 'Verzonden', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    failed: { icon: XCircle, label: 'Mislukt', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    pending: { icon: Clock, label: 'Bezig...', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  };

  const methodLabels: Record<string, string> = {
    smtp: 'SMTP',
    graph: 'Graph API',
    resend: 'Resend',
    outlook: 'Outlook',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-gold-500" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Verzonden Items</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{logs.length} e-mails</span>
          <button
            onClick={fetchLogs}
            className="p-2 text-gray-400 hover:text-gray-200 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 transition-colors"
            title="Vernieuwen"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          placeholder="Zoek in verzonden items..."
          className="w-full pl-9 pr-3 py-2 bg-dark-800 border border-dark-700 text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center mx-auto mb-4">
            <Mail size={24} className="text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm mb-1">
            {searchQuery ? 'Geen resultaten gevonden' : 'Nog geen e-mails verzonden'}
          </p>
          <p className="text-gray-600 text-xs">
            {searchQuery ? 'Probeer een andere zoekopdracht' : 'Verzonden e-mails verschijnen hier'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {paginatedLogs.map((log) => {
            const status = statusConfig[log.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} className="bg-dark-900 border border-dark-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-800 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${status.bg} border`}>
                    <StatusIcon size={14} className={status.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-100 truncate">
                        {log.to_name || log.to_email}
                      </span>
                      {log.to_name && (
                        <span className="text-xs text-gray-500 truncate hidden sm:inline">
                          &lt;{log.to_email}&gt;
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{log.subject}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-600 bg-dark-800 px-2 py-0.5 rounded border border-dark-700">
                      {methodLabels[log.method] || log.method}
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(log.sent_at)}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-dark-700 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Aan:</span>
                        <span className="text-gray-200 ml-2">{log.to_email}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-2 ${status.color}`}>{status.label}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Methode:</span>
                        <span className="text-gray-200 ml-2">{methodLabels[log.method] || log.method}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Datum:</span>
                        <span className="text-gray-200 ml-2">
                          {new Date(log.sent_at).toLocaleDateString('nl-NL', {
                            day: '2-digit', month: 'long', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                    {log.attachment_name && (
                      <div className="text-sm">
                        <span className="text-gray-500">Bijlage:</span>
                        <span className="text-gray-200 ml-2">{log.attachment_name}</span>
                      </div>
                    )}
                    {log.error_message && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                        <p className="text-xs text-red-400">{log.error_message}</p>
                      </div>
                    )}
                    {log.body && (
                      <div className="bg-dark-800 rounded-lg p-3 border border-dark-700">
                        <p className="text-xs text-gray-500 mb-1 font-medium">Bericht:</p>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{log.body}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filteredLogs.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={(page) => { setCurrentPage(page); }}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          label="e-mails"
        />
      )}
    </div>
  );
}
