import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, AlertCircle, Sparkles, PenLine } from 'lucide-react';

type PurchaseInvoiceUploadProps = {
  hasApiKey: boolean;
  onManualEntry: (fileName: string) => void;
  onSaveAndProcess: (file: File, fileName: string) => void;
  onCancel: () => void;
};

export function PurchaseInvoiceUpload({ hasApiKey, onManualEntry, onSaveAndProcess, onCancel }: PurchaseInvoiceUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const processFile = (selectedFile: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Ongeldig bestandstype. Upload een PNG, JPG, WebP of PDF bestand.');
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('Bestand is te groot. Maximaal 20MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);

    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-2xl shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold-500/10 rounded-lg">
              <Upload className="text-gold-500" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-100">Factuur Uploaden</h3>
              <p className="text-sm text-gray-400">Upload een factuur om toe te voegen</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-gold-500 bg-gold-500/5'
                  : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800/50'
              }`}
            >
              <Upload
                size={48}
                className={`mx-auto mb-4 ${isDragging ? 'text-gold-500' : 'text-gray-500'}`}
              />
              <p className="text-gray-200 font-medium mb-2">
                Sleep een factuur hierheen
              </p>
              <p className="text-gray-500 text-sm mb-4">
                of klik om een bestand te selecteren
              </p>
              <p className="text-gray-600 text-xs">
                Ondersteunde formaten: PNG, JPG, WebP, PDF (max 20MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-dark-800 rounded-lg">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg border border-dark-600"
                  />
                ) : (
                  <div className="w-20 h-20 bg-dark-700 rounded-lg flex items-center justify-center">
                    <FileText size={32} className="text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-100 font-medium truncate">{file.name}</p>
                  <p className="text-gray-500 text-sm">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setError(null);
                  }}
                  className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              {hasApiKey && (
                <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
                  <div className="flex items-start gap-3">
                    <Sparkles size={18} className="text-gold-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-200 font-medium">AI Herkenning beschikbaar</p>
                      <p className="text-xs text-gray-400 mt-1">
                        De factuur wordt opgeslagen en op de achtergrond automatisch herkend met AI. U kunt direct verder werken.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!hasApiKey && (
                <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-yellow-200 font-medium">Geen API key ingesteld</p>
                      <p className="text-xs text-yellow-300/70 mt-1">
                        Stel een OpenAI API key in bij Verhuurder om AI herkenning te gebruiken.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800/30 rounded-lg">
              <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-dark-700">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 bg-dark-700 text-gray-200 rounded-lg hover:bg-dark-600 transition-colors"
          >
            Annuleren
          </button>
          {file && (
            <>
              <button
                onClick={() => onManualEntry(file.name)}
                className="flex items-center gap-2 px-4 py-2.5 bg-dark-700 text-gray-200 rounded-lg hover:bg-dark-600 transition-colors text-sm font-medium border border-dark-600"
              >
                <PenLine size={16} />
                Handmatig Invullen
              </button>
              {hasApiKey && (
                <button
                  onClick={() => onSaveAndProcess(file, file.name)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gold-500 text-dark-950 rounded-lg hover:bg-gold-600 transition-colors font-medium"
                >
                  <Sparkles size={18} />
                  Opslaan & Herkennen
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
