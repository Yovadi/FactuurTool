import { useState, useEffect, useRef } from 'react';
import { supabase, type CompanySettings } from '../lib/supabase';
import { Save, Loader2, RotateCcw, Eye, EyeOff, Info, Copy, Check, Upload, Trash2, Image } from 'lucide-react';

const PLACEHOLDERS = [
  { code: '{naam}', description: 'Naam van de ontvanger' },
  { code: '{factuurnummer}', description: 'Het factuurnummer' },
  { code: '{bedrijfsnaam}', description: 'Uw bedrijfsnaam' },
  { code: '{bedrag}', description: 'Totaalbedrag factuur' },
  { code: '{factuurdatum}', description: 'Datum van de factuur' },
  { code: '{vervaldatum}', description: 'Vervaldatum factuur' },
  { code: '{iban}', description: 'Uw IBAN rekeningnummer' },
];

const DEFAULTS = {
  subject: 'Factuur {factuurnummer} van {bedrijfsnaam}',
  greeting: 'Beste {naam},',
  body: 'Hierbij ontvangt u factuur {factuurnummer} van {bedrijfsnaam}. De factuur is als PDF bijlage aan deze e-mail toegevoegd.',
  payment: 'Gelieve het bedrag voor de vervaldatum over te maken naar:',
  closing: 'Mocht u vragen hebben over deze factuur, neem dan gerust contact met ons op.',
  signature: 'Met vriendelijke groet,\n{bedrijfsnaam}',
};

type TemplateField = {
  key: keyof typeof DEFAULTS;
  dbKey: string;
  label: string;
  rows: number;
};

const FIELDS: TemplateField[] = [
  { key: 'subject', dbKey: 'email_subject_template', label: 'Onderwerp', rows: 1 },
  { key: 'greeting', dbKey: 'email_greeting_template', label: 'Aanhef', rows: 1 },
  { key: 'body', dbKey: 'email_body_template', label: 'Berichttekst', rows: 3 },
  { key: 'payment', dbKey: 'email_payment_text', label: 'Betalingstekst', rows: 2 },
  { key: 'closing', dbKey: 'email_closing_template', label: 'Afsluiting', rows: 2 },
  { key: 'signature', dbKey: 'email_signature_template', label: 'Ondertekening', rows: 2 },
];

export function EmailTemplateSettings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    subject: '',
    greeting: '',
    body: '',
    payment: '',
    closing: '',
    signature: '',
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
        setFormData({
          subject: data.email_subject_template || '',
          greeting: data.email_greeting_template || '',
          body: data.email_body_template || '',
          payment: data.email_payment_text || '',
          closing: data.email_closing_template || '',
          signature: data.email_signature_template || '',
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
          email_subject_template: formData.subject || null,
          email_greeting_template: formData.greeting || null,
          email_body_template: formData.body || null,
          email_payment_text: formData.payment || null,
          email_closing_template: formData.closing || null,
          email_signature_template: formData.signature || null,
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

  const handleReset = () => {
    setFormData({
      subject: '',
      greeting: '',
      body: '',
      payment: '',
      closing: '',
      signature: '',
    });
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

  const resolveTemplate = (template: string, defaultVal: string): string => {
    const text = template || defaultVal;
    return text
      .replace(/{naam}/g, 'Jan de Vries')
      .replace(/{factuurnummer}/g, 'INV-2025-042')
      .replace(/{bedrijfsnaam}/g, settings?.company_name || 'Uw Bedrijf')
      .replace(/{bedrag}/g, '\u20AC1.250,00')
      .replace(/{factuurdatum}/g, '01-03-2025')
      .replace(/{vervaldatum}/g, '31-03-2025')
      .replace(/{iban}/g, settings?.bank_account || 'NL00 BANK 0000 0000 00');
  };

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
      <div className="bg-dark-900 rounded-xl border border-dark-700 p-6">
        <div className="flex items-start gap-3 text-sm text-gray-400 bg-dark-800 rounded-lg p-4 border border-dark-700">
          <Info size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-gray-300 font-medium mb-1">Beschikbare variabelen</p>
            <p className="mb-3">Gebruik deze codes in uw tekst. Ze worden automatisch vervangen door de juiste gegevens bij het versturen.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {PLACEHOLDERS.map((p) => (
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
                  <span className="text-xs text-gray-500 hidden lg:inline truncate">{p.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-dark-900 rounded-xl border border-dark-700 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-100">E-mail Template</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-gray-300 hover:bg-dark-700 transition-colors"
            >
              {showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
              {showPreview ? 'Verberg voorbeeld' : 'Voorbeeld'}
            </button>
          </div>
        </div>

        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              {field.label}
            </label>
            {field.rows === 1 ? (
              <input
                type="text"
                value={formData[field.key]}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                placeholder={DEFAULTS[field.key]}
                className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-gray-600"
              />
            ) : (
              <textarea
                value={formData[field.key]}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                placeholder={DEFAULTS[field.key]}
                rows={field.rows}
                className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none placeholder:text-gray-600 leading-relaxed"
              />
            )}
            <p className="text-xs text-gray-600 mt-1">
              Standaard: <span className="text-gray-500">{DEFAULTS[field.key]}</span>
            </p>
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Handtekening afbeelding
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Upload een logo of afbeelding die onder uw ondertekening in de e-mail wordt geplaatst. (max 500KB)
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

        <div className="flex items-center gap-3 pt-2">
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
            {saving ? 'Opslaan...' : saved ? 'Opgeslagen!' : 'Opslaan'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 border border-dark-700 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors text-sm"
          >
            <RotateCcw size={15} />
            Standaard herstellen
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="bg-dark-900 rounded-xl border border-dark-700 p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Voorbeeld e-mail</h3>
          <div className="bg-white rounded-lg overflow-hidden">
            <div className="bg-[#1a1a2e] px-8 py-6">
              <h1 className="text-white text-lg font-bold">{settings.company_name}</h1>
            </div>
            <div className="px-8 py-8 space-y-4">
              <div className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2 border border-gray-200">
                Onderwerp: <span className="text-gray-700 font-medium">{resolveTemplate(formData.subject, DEFAULTS.subject)}</span>
              </div>

              <p className="text-[15px] text-gray-800 leading-relaxed">
                {resolveTemplate(formData.greeting, DEFAULTS.greeting)}
              </p>
              <p className="text-[15px] text-gray-800 leading-relaxed">
                {resolveTemplate(formData.body, DEFAULTS.body)}
              </p>

              <div className="bg-[#f8f9fb] rounded-lg border border-gray-200 p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Factuurnummer</span>
                    <p className="text-sm text-gray-900 font-semibold">INV-2025-042</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Totaalbedrag</span>
                    <p className="text-lg text-gray-900 font-bold">{'\u20AC'}1.250,00</p>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Factuurdatum</span>
                    <p className="text-sm text-gray-600">01-03-2025</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Vervaldatum</span>
                    <p className="text-sm text-gray-600">31-03-2025</p>
                  </div>
                </div>
              </div>

              <p className="text-[15px] text-gray-800 leading-relaxed">
                {resolveTemplate(formData.payment, DEFAULTS.payment)}
              </p>

              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex gap-3">
                  <span className="text-gray-400 w-16">IBAN</span>
                  <span className="font-semibold text-gray-900">{settings.bank_account || 'NL00 BANK 0000 0000 00'}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-400 w-16">t.n.v.</span>
                  <span className="font-semibold text-gray-900">{settings.company_name}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-400 w-16">Kenmerk</span>
                  <span className="font-semibold text-gray-900">INV-2025-042</span>
                </div>
              </div>

              <p className="text-[15px] text-gray-800 leading-relaxed">
                {resolveTemplate(formData.closing, DEFAULTS.closing)}
              </p>

              <div className="text-[15px] text-gray-800 whitespace-pre-line leading-relaxed">
                {resolveTemplate(formData.signature, DEFAULTS.signature)}
              </div>

              {signatureImage && (
                <div className="mt-4">
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
