/** Primary invoice lists fill leftover height only when they have rows. An empty list stays as tall as its message. */
export function invoiceSectionFrameClass(grow: boolean, itemCount: number): string {
  const stretch = grow && itemCount > 0;
  return [
    'bg-dark-900 rounded-lg shadow-sm border border-dark-700 min-h-0 flex flex-col overflow-hidden',
    stretch ? 'flex-1' : 'flex-shrink-0',
    grow ? '' : 'max-h-[40%]',
  ].filter(Boolean).join(' ');
}
