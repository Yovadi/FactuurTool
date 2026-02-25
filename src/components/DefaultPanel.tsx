import { useState } from 'react';
import { QuickSummaryPanel } from './QuickSummaryPanel';
import { ActivityLogPanel } from './ActivityLogPanel';
import { BarChart3, ScrollText } from 'lucide-react';

type PanelView = 'summary' | 'activity';

export function DefaultPanel() {
  const [view, setView] = useState<PanelView>('summary');

  return (
    <div className="w-1/2 flex-shrink-0 border-l border-dark-700 bg-dark-900 overflow-hidden flex flex-col">
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex gap-1 bg-dark-800 rounded-lg p-1">
          <button
            onClick={() => setView('summary')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'summary'
                ? 'bg-gold-500 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <BarChart3 size={15} />
            Snelle Samenvatting
          </button>
          <button
            onClick={() => setView('activity')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'activity'
                ? 'bg-gold-500 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <ScrollText size={15} />
            Activiteitenlogboek
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {view === 'summary' && <QuickSummaryPanel />}
        {view === 'activity' && <ActivityLogPanel />}
      </div>
    </div>
  );
}
