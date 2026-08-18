export function bookingTimesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const aStart = startA.substring(0, 5);
  const aEnd = endA.substring(0, 5);
  const bStart = startB.substring(0, 5);
  const bEnd = endB.substring(0, 5);
  return (
    (aStart >= bStart && aStart < bEnd) ||
    (aEnd > bStart && aEnd <= bEnd) ||
    (aStart <= bStart && aEnd >= bEnd)
  );
}
