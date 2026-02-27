import { useState, useEffect, useMemo } from 'react';
import { supabase, type CompanySettings, type Tenant, type ExternalCustomer } from '../lib/supabase';
import { sendEmail, getActiveEmailMethodLabel } from '../utils/emailSender';
import { wrapInEmailHtml } from '../utils/emailTemplate';
import { Send, Loader2, Paperclip, X, User, ChevronDown, Eye, EyeOff } from 'lucide-react';

type Props = {
  companySettings: CompanySettings;
  prefillTo?: string;
  prefillToName?: string;
  prefillSubject?: string;
  prefillBody?: string;
  prefillInvoiceId?: string;
  onSent?: () => void;
};

export function EmailCompose({ companySettings, prefillTo, prefillToName, prefillSubject, prefillBody, prefillInvoiceId, onSent }: Props) {
  const [to, setTo] = useState(prefillTo || '');
  const [toName, setToName] = useState(prefillToName || '');
  const [subject, setSubject] = useState(prefillSubject || '');
  const [body, setBody] = useState(prefillBody || '');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [contacts, setContacts] = useState<{ email: string; name: string; company: string }[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  const methodLabel = getActiveEmailMethodLabel(companySettings);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (prefillTo) setTo(prefillTo);
    if (prefillToName) setToName(prefillToName);
    if (prefillSubject) setSubject(prefillSubject);
    if (prefillBody) setBody(prefillBody);
  }, [prefillTo, prefillToName, prefillSubject, prefillBody]);

  const loadContacts = async () => {
    const [{ data: tenants }, { data: externals }] = await Promise.all([
      supabase.from('tenants').select('name, company_name, email'),
      supabase.from('external_customers').select('contact_name, company_name, email'),
    ]);

    const all: { email: string; name: string; company: string }[] = [];
    (tenants || []).forEach((t: Tenant) => {
      if (t.email) all.push({ email: t.email, name: t.name, company: t.company_name });
    });
    (externals || []).forEach((e: ExternalCustomer) => {
      if (e.email) all.push({ email: e.email, name: e.contact_name, company: e.company_name });
    });
    setContacts(all);
  };

  const filteredContacts = contacts.filter(c => {
    const q = contactSearch.toLowerCase();
    return c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q);
  });

  const previewHtml = useMemo(() => {
    return wrapInEmailHtml(companySettings, body, companySettings.email_signature_image);
  }, [body, companySettings]);

  const handleSend = async () => {
    if (!to || !subject) return;
    setSending(true);
    setResult(null);

    const res = await sendEmail(companySettings, {
      to,
      toName,
      subject,
      body,
      html: previewHtml,
      invoiceId: prefillInvoiceId,
    });

    if (res.success) {
      setResult({ success: true, message: 'E-mail succesvol verzonden!' });
      onSent?.();
    } else {
      setResult({ success: false, message: res.error || 'Fout bij verzenden' });
    }
    setSending(false);
  };

  const selectContact = (contact: { email: string; name: string; company: string }) => {
    setTo(contact.email);
    setToName(contact.name || contact.company);
    setShowContacts(false);
    setContactSearch('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-100">Nieuwe E-mail</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(p => !p)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showPreview
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                : 'bg-dark-800 border-dark-700 text-gray-500 hover:text-gray-300 hover:border-dark-600'
            }`}
          >
            {showPreview ? <Eye size={12} /> : <EyeOff size={12} />}
            Voorbeeld
          </button>
          {methodLabel && (
            <span className="text-xs text-gray-500 bg-dark-800 px-3 py-1 rounded-full border border-dark-700">
              Via {methodLabel}
            </span>
          )}
        </div>
      </div>

      <div className={`flex gap-5 ${showPreview ? '' : 'flex-col'}`}>
        <div className={`space-y-3 ${showPreview ? 'w-1/2 flex-shrink-0' : 'w-full'}`}>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Aan</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="email@voorbeeld.nl"
                  className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                {to && toName && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                    {toName}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowContacts(!showContacts)}
                className="px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg hover:bg-dark-700 transition-colors text-gray-400 hover:text-gray-200"
                title="Kies ontvanger"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {showContacts && (
              <div className="absolute z-50 mt-1 w-full bg-dark-800 border border-dark-600 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-2 border-b border-dark-700">
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Zoek contactpersoon..."
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-600 text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-500 text-sm">Geen contacten gevonden</div>
                  ) : (
                    filteredContacts.map((c, i) => (
                      <button
                        key={`${c.email}-${i}`}
                        onClick={() => selectContact(c)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-dark-700 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-100 truncate">{c.name || c.company}</p>
                          <p className="text-xs text-gray-500 truncate">{c.email}</p>
                        </div>
                        <span className="text-xs text-gray-600 truncate max-w-[120px]">{c.company}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Onderwerp</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Onderwerp van de e-mail"
              className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Bericht</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Typ hier je bericht..."
              rows={showPreview ? 14 : 10}
              className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none leading-relaxed"
            />
          </div>
        </div>

        {showPreview && (
          <div className="w-1/2 flex-shrink-0">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Voorbeeld e-mail</label>
            <div className="border border-dark-600 rounded-lg overflow-hidden bg-white" style={{ height: 'calc(100% - 28px)' }}>
              <iframe
                srcDoc={previewHtml}
                title="E-mail voorbeeld"
                className="w-full h-full border-0"
                style={{ minHeight: '420px' }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          result.success
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {result.success ? (
            <Send size={14} />
          ) : (
            <X size={14} />
          )}
          {result.message}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Paperclip size={12} />
          <span>Bijlagen worden automatisch toegevoegd bij factuurverzending</span>
        </div>
        <button
          onClick={handleSend}
          disabled={sending || !to || !subject}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {sending ? 'Verzenden...' : 'Versturen'}
        </button>
      </div>
    </div>
  );
}
