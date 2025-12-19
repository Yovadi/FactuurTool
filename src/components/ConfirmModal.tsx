import { X, AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'danger';
}

export function ConfirmModal({
  title,
  message,
  confirmText = 'Bevestigen',
  cancelText = 'Annuleren',
  onConfirm,
  onCancel,
  variant = 'default'
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg border border-dark-700 max-w-md w-full shadow-xl animate-fade-in">
        <div className="flex items-start justify-between p-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            {variant === 'danger' && (
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle size={24} className="text-red-400" />
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-300 whitespace-pre-line">{message}</p>
        </div>

        <div className="flex gap-3 p-6 border-t border-dark-700">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              variant === 'danger'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
