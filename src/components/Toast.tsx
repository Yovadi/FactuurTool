import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle2 size={20} className="text-emerald-400" />,
    error: <AlertCircle size={20} className="text-red-400" />,
    info: <Info size={20} className="text-blue-400" />
  };

  const styles = {
    success: 'bg-emerald-900/90 border-emerald-500/50 backdrop-blur-sm',
    error: 'bg-red-900/90 border-red-500/50 backdrop-blur-sm',
    info: 'bg-blue-900/90 border-blue-500/50 backdrop-blur-sm'
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${styles[type]} shadow-xl animate-slide-in-right`}>
      {icons[type]}
      <p className="flex-1 text-sm text-white font-medium">{message}</p>
      <button
        onClick={onClose}
        className="text-gray-300 hover:text-white transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  );
}
