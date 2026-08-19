import { AlertTriangle } from 'lucide-react';

export function TestModeBanner({ testDate }: { testDate?: string | null }) {
  return (
    <div className="flex-shrink-0 bg-amber-500 text-dark-950 px-4 py-2 flex items-center justify-center gap-2 text-sm font-semibold">
      <AlertTriangle size={16} />
      Testmodus actief{testDate ? ` — testdatum ${new Date(testDate).toLocaleDateString('nl-NL')}` : ''}. Facturen en e-mails zijn oefenverkeer.
    </div>
  );
}
