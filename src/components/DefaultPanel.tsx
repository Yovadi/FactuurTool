import { useState, useEffect } from 'react';
import { QuickSummaryPanel } from './QuickSummaryPanel';
import { ActivityLogPanel } from './ActivityLogPanel';

export type DefaultPanelType = 'none' | 'summary' | 'activity';

export function getDefaultPanelSetting(): DefaultPanelType {
  const val = localStorage.getItem('hal5-default-panel');
  if (val === 'summary' || val === 'activity' || val === 'none') return val;
  return 'none';
}

export function setDefaultPanelSetting(value: DefaultPanelType) {
  localStorage.setItem('hal5-default-panel', value);
  window.dispatchEvent(new CustomEvent('default-panel-changed', { detail: { panel: value } }));
}

export function DefaultPanel() {
  const [panelType, setPanelType] = useState<DefaultPanelType>(getDefaultPanelSetting);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPanelType(detail.panel);
    };
    window.addEventListener('default-panel-changed', handler);
    return () => window.removeEventListener('default-panel-changed', handler);
  }, []);

  if (panelType === 'none') return null;

  return (
    <div className="w-1/2 flex-shrink-0 border-l border-dark-700 bg-dark-900 overflow-hidden">
      {panelType === 'summary' && <QuickSummaryPanel />}
      {panelType === 'activity' && <ActivityLogPanel />}
    </div>
  );
}

export function useDefaultPanel() {
  const [panelType, setPanelType] = useState<DefaultPanelType>(getDefaultPanelSetting);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPanelType(detail.panel);
    };
    window.addEventListener('default-panel-changed', handler);
    return () => window.removeEventListener('default-panel-changed', handler);
  }, []);

  return panelType !== 'none';
}
