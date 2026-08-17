import { CalendarClock, X } from 'lucide-react';
import type { BookingInvite } from '../utils/bookingInvite';
import { formatBookingInvite } from '../utils/bookingInvite';

type BookingInvitePopupProps = {
  invite: BookingInvite;
  remainingCount: number;
  onView: () => void;
  onDismiss: () => void;
};

export function BookingInvitePopup({ invite, remainingCount, onView, onDismiss }: BookingInvitePopupProps) {
  const { title, body } = formatBookingInvite(invite);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
      <div className="bg-dark-900 rounded-lg border border-gold-600/40 max-w-md w-full shadow-2xl animate-fade-in">
        <div className="flex items-start justify-between p-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold-600/15 rounded-lg">
              <CalendarClock size={24} className="text-gold-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Via de boekingspagina</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Sluiten"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-gray-200">{body}</p>
          {remainingCount > 0 && (
            <p className="text-sm text-gold-400">
              Nog {remainingCount} andere aanvraag{remainingCount === 1 ? '' : 'en'} in de wachtrij.
            </p>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-dark-700">
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2 bg-dark-800 text-gray-300 rounded-lg hover:bg-dark-700 transition-colors"
          >
            Later
          </button>
          <button
            onClick={onView}
            className="flex-1 px-4 py-2 bg-gold-600 text-dark-900 font-medium rounded-lg hover:bg-gold-500 transition-colors"
          >
            Bekijk aanvraag
          </button>
        </div>
      </div>
    </div>
  );
}
