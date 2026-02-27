import { useState, useEffect, useRef } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { Save, Loader2, RotateCcw, Eye, EyeOff, Info, Copy, Check, Upload, Trash2, Image, FileText, Clock, CreditCard } from 'lucide-react';

type TemplateType = 'invoice' | 'reminder' | 'credit_note';

const TABS: { key: TemplateType; label: string; icon: typeof FileText }[] = [
  { key: 'invoice', label: 'Factuur', icon: FileText },
  { key: 'reminder', label: 'Herinnering', icon: Clock },
  { key: 'credit_note', label: 'Credit factuur', icon: CreditCard },
];

const PLACEHOLDERS_INVOICE = [
  { code: '{naam}', description: 'Naam ontvanger' },
  { code: '{factuurnummer}', description: 'Factuurnummer' },
  { code: '{bedrijfsnaam}', description: 'Uw bedrijfsnaam' },
  { code: '{bedrag}', description: 'Totaalbedrag' },
  { code: '{factuurdatum}', description: 'Factuurdatum' },
  { code: '{vervaldatum}', description: 'Vervaldatum' },
  { code: '{iban}', description: 'IBAN nummer' },
];

const PLACEHOLDERS_CREDIT = [
  { code: '{naam}', description: 'Naam ontvanger' },
  { code: '{creditnotanummer}', description: 'Credit nota nummer' },
  { code: '{bedrijfsnaam}', description: 'Uw bedrijfsnaam' },
  { code: '{bedrag}', description: 'Totaalbedrag' },
  { code: '{reden}', description: 'Reden creditering' },
  { code: '{iban}', description: 'IBAN nummer' },
];

const DEFAULT_TEMPLATES: Record<TemplateType, { subject: string; body: string }> = {
  invoice: {
    subject: 'Factuur {factuurnummer} van {bedrijfsnaam}',
    body: `Beste {naam},

Hierbij ontvangt u factuur {factuurnummer} van {bedrijfsnaam}. De factuur is als PDF bijlage aan deze e-mail toegevoegd.

Factuurnummer: {factuurnummer}
Bedrag: {bedrag}
Factuurdatum: {factuurdatum}
Vervaldatum: {vervaldatum}

Gelieve het bedrag voor de vervaldatum over te maken naar:
IBAN: {iban}
t.n.v.: {bedrijfsnaam}
Kenmerk: {factuurnummer}

Mocht u vragen hebben over deze factuur, neem dan gerust contact met ons op.

Met vriendelijke groet,
{bedrijfsnaam}`,
  },
  reminder: {
    subject: 'Betalingsherinnering factuur {factuurnummer}',
    body: `Beste {naam},

Uit onze administratie blijkt dat wij nog geen betaling hebben ontvangen voor onderstaande factuur:

Factuurnummer: {factuurnummer}
Bedrag: {bedrag}
Factuurdatum: {factuurdatum}
Vervaldatum: {vervaldatum}

Wij verzoeken u vriendelijk het openstaande bedrag zo spoedig mogelijk over te maken naar:
IBAN: {iban}
t.n.v.: {bedrijfsnaam}
Kenmerk: {factuurnummer}

Mocht u de betaling reeds hebben verricht, dan kunt u dit bericht als niet verstuurd beschouwen.

Met vriendelijke groet,
{bedrijfsnaam}`,
  },
  credit_note: {
    subject: 'Credit nota {creditnotanummer} van {bedrijfsnaam}',
    body: `Beste {naam},

Hierbij ontvangt u credit nota {creditnotanummer} van {bedrijfsnaam}. De credit nota is als PDF bijlage aan deze e-mail toegevoegd.

Credit nota nummer: {creditnotanummer}
Bedrag: {bedrag}
Reden: {reden}

Het creditbedrag wordt verrekend met toekomstige facturen, of op verzoek teruggestort.

Mocht u vragen hebben, neem dan gerust contact met ons op.

Met vriendelijke groet,
{bedrijfsnaam}`,
  },
};

const SAMPLE_DATA_INVOICE = {
  '{naam}': 'Jan de Vries',
  '{factuurnummer}': 'INV-2025-042',
  '{bedrag}': '\u20AC1.250,00',
  '{factuurdatum}': '01-03-2025',
  '{vervaldatum}': '31-03-2025',
};

const SAMPLE_DATA_CREDIT = {
  '{naam}': 'Jan de Vries',
  '{creditnotanummer}': 'CN-2025-008',
  '{bedrag}': '\u20AC250,00',
  '{reden}': 'Correctie huurprijs maart 2025',
};

export function EmailTemplateSettings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TemplateType>('invoice');
  const [showPreview, setShowPreview] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subjects, setSubjects] = useState({
    invoice: '',
    reminder: '',
    credit_note: '',
  });

  const [bodies, setBodies] = useState({
    invoice: '',
    reminder: '',
    credit_note: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
      if (data) {
        setSubjects({
          invoice: data.email_subject_template || '',
          reminder: data.email_subject_reminder || '',
          credit_note: data.email_subject_credit_note || '',
        });
        setBodies({
          invoice: data.email_template_invoice || '',
          reminder: data.email_template_reminder || '',
          credit_note: data.email_template_credit_note || '',
        });
        setSignatureImage(data.email_signature_image || null);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);

    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          email_subject_template: subjects.invoice || null,
          email_subject_reminder: subjects.reminder || null,
          email_subject_credit_note: subjects.credit_note || null,
          email_template_invoice: bodies.invoice || null,
          email_template_reminder: bodies.reminder || null,
          email_template_credit_note: bodies.credit_note || null,
          email_signature_image: signatureImage,
        })
        .eq('id', settings.id);

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await fetchSettings();
    } catch (error) {
      console.error('Error saving template:', error);
    }
    setSaving(false);
  };

  const handleResetCurrent = () => {
    setSubjects(prev => ({ ...prev, [activeTab]: '' }));
    setBodies(prev => ({ ...prev, [activeTab]: '' }));
  };

  const copyPlaceholder = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 500 * 1024) {
      alert('Afbeelding mag maximaal 500KB zijn.');
      return;
    }
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      setSignatureImage(reader.result as string);
      setUploadingImage(false);
    };
    reader.onerror = () => setUploadingImage(false);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSignatureImage = () => {
    setSignatureImage(null);
  };

  const placeholders = activeTab === 'credit_note' ? PLACEHOLDERS_CREDIT : PLACEHOLDERS_INVOICE;

  const resolvePreview = (text: string): string => {
    const sampleData = activeTab === 'credit_note'
      ? { ...SAMPLE_DATA_CREDIT, '{bedrijfsnaam}': settings?.company_name || 'Uw Bedrijf', '{iban}': settings?.bank_account || 'NL00 BANK 0000 0000 00' }
      : { ...SAMPLE_DATA_INVOICE, '{bedrijfsnaam}': settings?.company_name || 'Uw Bedrijf', '{iban}': settings?.bank_account || 'NL00 BANK 0000 0000 00' };

    let result = text;
    for (const [key, value] of Object.entries(sampleData)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    return result;
  };

  const currentSubject = subjects[activeTab] || DEFAULT_TEMPLATES[activeTab].subject;
  const currentBody = bodies[activeTab] || DEFAULT_TEMPLATES[activeTab].body;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gold-500" size={28} />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-dark-900 rounded-xl border border-dark-700 p-8 text-center">
        <p className="text-gray-400">Sla eerst uw bedrijfsgegevens op voordat u de e-mailtemplate kunt aanpassen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
        <div className="flex border-b border-dark-700">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 text-sm font-medium transition-colors relative ${
                  isActive
                    ? 'text-gold-400 bg-dark-800'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-dark-850'
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500" />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          <div className="flex items-start gap-3 text-sm text-gray-400 bg-dark-800 rounded-lg p-4 border border-dark-700 mb-6">
            <Info size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-300 font-medium mb-1">Beschikbare variabelen</p>
              <p className="mb-3">Gebruik deze codes in uw tekst. Ze worden automatisch vervangen door de juiste gegevens bij het versturen.</p>
              <div className="flex flex-wrap gap-2">
                {placeholders.map((p) => (
                  <button
                    key={p.code}
                    onClick={() => copyPlaceholder(p.code)}
                    className="flex items-center gap-2 px-3 py-2 bg-dark-900 rounded-lg border border-dark-600 hover:border-blue-500/50 transition-colors text-left group"
                  >
                    <code className="text-blue-400 text-xs font-mono">{p.code}</code>
                    {copiedCode === p.code ? (
                      <Check size={12} className="text-green-400 flex-shrink-0" />
                    ) : (
                      <Copy size={12} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-xs text-gray-500 hidden sm:inline">{p.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Onderwerp
              </label>
              <input
                type="text"
                value={subjects[activeTab]}
                onChange={(e) => setSubjects(prev => ({ ...prev, [activeTab]: e.target.value }))}
                placeholder={DEFAULT_TEMPLATES[activeTab].subject}
                className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-gray-600"
              />
              <p className="text-xs text-gray-600 mt-1">
                Standaard: <span className="text-gray-500">{DEFAULT_TEMPLATES[activeTab].subject}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                E-mail inhoud
              </label>
              <textarea
                value={bodies[activeTab]}
                onChange={(e) => setBodies(prev => ({ ...prev, [activeTab]: e.target.value }))}
                placeholder={DEFAULT_TEMPLATES[activeTab].body}
                rows={16}
                className="w-full px-4 py-3 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y placeholder:text-gray-600 leading-relaxed font-mono"
              />
              <p className="text-xs text-gray-600 mt-1">
                Laat leeg om de standaard template te gebruiken. De volledige e-mailtekst wordt hier geschreven, inclusief aanhef, berichttekst en afsluiting.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-dark-900 rounded-xl border border-dark-700 p-6">
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Handtekening afbeelding
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Upload een logo of afbeelding die onder de e-mail wordt geplaatst. (max 500KB) Geldt voor alle templates.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />

        {signatureImage ? (
          <div className="space-y-3">
            <div className="bg-dark-800 border border-dark-600 rounded-lg p-4 inline-block">
              <img
                src={signatureImage}
                alt="Handtekening afbeelding"
                className="max-h-32 max-w-xs object-contain"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-600 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors text-sm"
              >
                <Upload size={14} />
                Vervangen
              </button>
              <button
                type="button"
                onClick={removeSignatureImage}
                className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-red-900/50 text-red-400 rounded-lg hover:bg-red-900/20 transition-colors text-sm"
              >
                <Trash2 size={14} />
                Verwijderen
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="flex items-center gap-3 px-5 py-4 bg-dark-800 border-2 border-dashed border-dark-600 text-gray-400 rounded-lg hover:border-blue-500/50 hover:text-gray-300 transition-colors text-sm w-full justify-center"
          >
            {uploadingImage ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Image size={18} />
            )}
            {uploadingImage ? 'Uploaden...' : 'Klik om een afbeelding te uploaden'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : saved ? (
            <Check size={16} />
          ) : (
            <Save size={16} />
          )}
          {saving ? 'Opslaan...' : saved ? 'Opgeslagen!' : 'Alle templates opslaan'}
        </button>
        <button
          onClick={handleResetCurrent}
          className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 border border-dark-700 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors text-sm"
        >
          <RotateCcw size={15} />
          Huidige template herstellen
        </button>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 border border-dark-700 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors text-sm ml-auto"
        >
          {showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
          {showPreview ? 'Verberg voorbeeld' : 'Voorbeeld'}
        </button>
      </div>

      {showPreview && (
        <div className="bg-dark-900 rounded-xl border border-dark-700 p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Voorbeeld: {TABS.find(t => t.key === activeTab)?.label}
          </h3>
          <div className="bg-white rounded-lg overflow-hidden">
            <div className="bg-[#1a1a2e] px-8 py-6">
              <h1 className="text-white text-lg font-bold">{settings.company_name}</h1>
            </div>
            <div className="px-8 py-8 space-y-1">
              <div className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2 border border-gray-200 mb-4">
                Onderwerp: <span className="text-gray-700 font-medium">{resolvePreview(currentSubject)}</span>
              </div>
              <div className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-line">
                {resolvePreview(currentBody)}
              </div>
              {signatureImage && (
                <div className="mt-4 pt-2">
                  <img src={signatureImage} alt="Handtekening" style={{ maxHeight: 100, maxWidth: 200 }} className="object-contain" />
                </div>
              )}
            </div>
            <div className="px-8 pb-8">
              <div className="border-t border-gray-200 pt-5 text-xs text-gray-400 space-y-0.5">
                <p>{settings.address}{settings.postal_code || settings.city ? `, ${settings.postal_code} ${settings.city}` : ''}</p>
                {settings.phone && <p>Tel: {settings.phone}</p>}
                {settings.email && <p>E-mail: {settings.email}</p>}
                {settings.kvk_number && <p className="text-gray-300">KVK: {settings.kvk_number}</p>}
                {settings.vat_number && <p className="text-gray-300">BTW: {settings.vat_number}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
