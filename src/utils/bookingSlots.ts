export type TimeSlot = { start: string; end: string };

function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return a.start < b.end && a.end > b.start;
}

export function suggestAlternativeSlots(
  desired: TimeSlot,
  occupied: TimeSlot[],
  options?: { dayStart?: string; dayEnd?: string; maxSuggestions?: number }
): TimeSlot[] {
  const dayStart = toMinutes(options?.dayStart || '08:00');
  const dayEnd = toMinutes(options?.dayEnd || '18:00');
  const duration = Math.max(toMinutes(desired.end) - toMinutes(desired.start), 30);
  const maxSuggestions = options?.maxSuggestions ?? 3;
  const busy = occupied
    .map(slot => ({ start: toMinutes(slot.start), end: toMinutes(slot.end) }))
    .sort((a, b) => a.start - b.start);

  const suggestions: TimeSlot[] = [];
  let cursor = dayStart;
  for (const block of busy) {
    if (block.start - cursor >= duration) {
      suggestions.push({ start: fromMinutes(cursor), end: fromMinutes(cursor + duration) });
      if (suggestions.length >= maxSuggestions) return suggestions;
    }
    cursor = Math.max(cursor, block.end);
  }
  if (dayEnd - cursor >= duration && suggestions.length < maxSuggestions) {
    suggestions.push({ start: fromMinutes(cursor), end: fromMinutes(cursor + duration) });
  }
  return suggestions;
}
