import { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, X } from 'lucide-react';

type UpdateDialogProps = {
  type: 'update-available' | 'update-not-available' | 'update-downloaded' | 'update-error' | 'downloading';
  currentVersion?: string;
  newVersion?: string;
  error?: string;
  progress?: number;
  onDownload?: () => void;
  onInstall?: () => void;
  onClose?: () => void;
};

export function UpdateDialog({
  type,
  currentVersion,
  newVersion,
  error,
  progress = 0,
  onDownload,
  onInstall,
  onClose
}: UpdateDialogProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    setShow(true);
  }, [type]);

  if (!show) return null;

  const handleClose = () => {
    setShow(false);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-xl shadow-2xl border border-dark-700 max-w-md w-full overflow-hidden">
        <div className="relative p-6 pb-4">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>

          {type === 'update-available' && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-900/50 rounded-lg">
                  <Download className="text-blue-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-100">Update Beschikbaar</h3>
              </div>
              <div className="space-y-3 mb-6">
                <p className="text-gray-300">
                  Er is een nieuwe versie beschikbaar!
                </p>
                <div className="bg-dark-800 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Huidige versie:</span>
                    <span className="text-gray-200 font-medium">{currentVersion}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Nieuwe versie:</span>
                    <span className="text-gold-500 font-medium">{newVersion}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  De update wordt geïnstalleerd wanneer u de applicatie afsluit.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded-lg transition-colors border border-dark-600"
                >
                  Later
                </button>
                <button
                  onClick={() => {
                    onDownload?.();
                    handleClose();
                  }}
                  className="flex-1 px-4 py-2.5 bg-gold-500 hover:bg-gold-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Download
                </button>
              </div>
            </>
          )}

          {type === 'downloading' && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-900/50 rounded-lg">
                  <Download className="text-blue-400 animate-bounce" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-100">Update Downloaden</h3>
              </div>
              <div className="space-y-4 mb-6">
                <p className="text-gray-300">
                  Update wordt gedownload op de achtergrond...
                </p>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Voortgang</span>
                    <span className="text-gray-200 font-medium">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-dark-800 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-gold-500 to-gold-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full px-4 py-2.5 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded-lg transition-colors border border-dark-600"
              >
                Minimaliseren
              </button>
            </>
          )}

          {type === 'update-downloaded' && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-900/50 rounded-lg">
                  <CheckCircle className="text-green-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-100">Update Klaar</h3>
              </div>
              <div className="space-y-3 mb-6">
                <p className="text-gray-300">
                  Update is gedownload en kan nu geïnstalleerd worden.
                </p>
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-sm text-gray-400">
                    De applicatie zal opnieuw opstarten om de update te installeren.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded-lg transition-colors border border-dark-600"
                >
                  Later
                </button>
                <button
                  onClick={() => {
                    onInstall?.();
                    handleClose();
                  }}
                  className="flex-1 px-4 py-2.5 bg-gold-500 hover:bg-gold-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  Nu Installeren
                </button>
              </div>
            </>
          )}

          {type === 'update-not-available' && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-900/50 rounded-lg">
                  <CheckCircle className="text-green-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-100">Geen Updates</h3>
              </div>
              <div className="space-y-3 mb-6">
                <p className="text-gray-300">
                  U gebruikt al de nieuwste versie
                </p>
                <div className="bg-dark-800 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Huidige versie:</span>
                    <span className="text-gray-200 font-medium">{currentVersion}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full px-4 py-2.5 bg-gold-500 hover:bg-gold-600 text-white font-semibold rounded-lg transition-colors"
              >
                Sluiten
              </button>
            </>
          )}

          {type === 'update-error' && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-900/50 rounded-lg">
                  <AlertCircle className="text-red-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-100">Update Fout</h3>
              </div>
              <div className="space-y-3 mb-6">
                <p className="text-gray-300">
                  Er ging iets fout bij het checken voor updates
                </p>
                {error && (
                  <div className="bg-dark-800 rounded-lg p-3">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleClose}
                className="w-full px-4 py-2.5 bg-dark-800 hover:bg-dark-700 text-gray-300 rounded-lg transition-colors border border-dark-600"
              >
                Sluiten
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
