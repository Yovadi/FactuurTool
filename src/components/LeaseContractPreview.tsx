import { useState, useEffect, useRef } from 'react';
import { X, Download, Upload, Loader2 } from 'lucide-react';
import {
  generateLeaseContractPDFBlobUrl,
  generateLeaseContractPDF,
  generateLeaseContractPDFBase64,
  type LeaseContractData,
} from '../utils/leaseContractPdf';
import { supabase, type CompanySettings } from '../lib/supabase';

interface LeaseContractPreviewProps {
  leaseData: LeaseContractData;
  tenantCompanyName: string;
  onClose: () => void;
}

export function LeaseContractPreview({
  leaseData,
  tenantCompanyName,
  onClose,
}: LeaseContractPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const pdfLoadingRef = useRef(false);

  useEffect(() => {
    if (pdfLoadingRef.current) return;
    pdfLoadingRef.current = true;

    generateLeaseContractPDFBlobUrl(leaseData)
      .then((url) => {
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch((err) => {
        console.error('Lease PDF generation error:', err);
      })
      .finally(() => {
        pdfLoadingRef.current = false;
        setPdfLoading(false);
      });

    return () => {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const handleDownload = async () => {
    await generateLeaseContractPDF(leaseData);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      if (!settings) {
        setSaveMessage('Bedrijfsinstellingen niet gevonden');
        setSaving(false);
        return;
      }

      const companySettings = settings as CompanySettings;
      const sanitizedName = tenantCompanyName.replace(/[<>:"/\\|?*]/g, '_').trim();
      const fileName = `Huurcontract_${sanitizedName}.pdf`;
      let savedLocal = false;
      let savedOneDrive = false;

      if (
        window.electronAPI?.savePDF &&
        companySettings.root_folder_path
      ) {
        const pdf = await generateLeaseContractPDF(leaseData);
        const pdfBuffer = pdf.output('arraybuffer');
        const folderPath = `${companySettings.root_folder_path}/${sanitizedName}/Huurcontract`;
        const result = await window.electronAPI.savePDF(
          pdfBuffer,
          folderPath,
          fileName
        );
        if (result.success) {
          savedLocal = true;
        } else {
          console.error('Local save failed:', result.error);
        }
      }

      if (
        companySettings.onedrive_enabled &&
        companySettings.onedrive_user_email &&
        companySettings.graph_tenant_id &&
        companySettings.graph_client_id &&
        companySettings.graph_client_secret
      ) {
        const pdfBase64 = await generateLeaseContractPDFBase64(leaseData);
        const basePath = companySettings.onedrive_folder_path || 'Facturen';
        const folderPath = `${basePath}/${sanitizedName}/Huurcontract`;

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/onedrive-upload`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              action: 'upload',
              graph: {
                tenant_id: companySettings.graph_tenant_id,
                client_id: companySettings.graph_client_id,
                client_secret: companySettings.graph_client_secret,
              },
              user_email: companySettings.onedrive_user_email,
              folder_path: folderPath,
              file_name: fileName,
              file_content_base64: pdfBase64,
            }),
          }
        );

        const result = await response.json();
        if (result.success) {
          savedOneDrive = true;
        } else {
          console.error('OneDrive upload failed:', result.error);
        }
      }

      if (savedLocal && savedOneDrive) {
        setSaveMessage('Opgeslagen op schijf en OneDrive');
      } else if (savedLocal) {
        setSaveMessage('Opgeslagen op schijf');
      } else if (savedOneDrive) {
        setSaveMessage('Opgeslagen op OneDrive');
      } else {
        setSaveMessage(
          'Geen opslaglocatie geconfigureerd. Configureer een lokale map of OneDrive in instellingen.'
        );
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveMessage('Fout bij opslaan');
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dark-900 rounded-lg my-8 relative w-full max-w-5xl mx-4 h-[90vh] flex flex-col border border-dark-700">
        <div className="flex-shrink-0 bg-dark-800 rounded-t-lg border-b border-dark-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-100">
            Huurcontract{' '}
            <span className="text-gold-500">{tenantCompanyName}</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white transition-colors px-3 py-1.5 rounded-lg"
              title="Download PDF"
            >
              <Download size={16} />
              <span className="text-sm font-medium">Download</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white transition-colors px-3 py-1.5 rounded-lg disabled:opacity-50"
              title="Opslaan naar map / OneDrive"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              <span className="text-sm font-medium">Opslaan</span>
            </button>
            <button
              onClick={onClose}
              className="bg-red-600 hover:bg-red-500 text-white transition-colors p-1.5 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {saveMessage && (
          <div
            className={`mx-6 mt-3 px-4 py-2 rounded-lg text-sm ${
              saveMessage.includes('Fout') || saveMessage.includes('Geen')
                ? 'bg-red-900/50 text-red-300'
                : 'bg-green-900/50 text-green-300'
            }`}
          >
            {saveMessage}
          </div>
        )}

        <div className="flex-1 overflow-hidden bg-gray-700 rounded-b-lg">
          {pdfLoading || !pdfUrl ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2
                  size={28}
                  className="text-gold-500 animate-spin"
                />
                <span className="text-sm text-gray-400">
                  PDF genereren...
                </span>
              </div>
            </div>
          ) : (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={`Huurcontract ${tenantCompanyName}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
