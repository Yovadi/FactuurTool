import { addCalendarDays, amsterdamCalendar, amsterdamInstant } from './amsterdamCalendar';

/** Calendar date the business uses: the test date when test mode is on, otherwise Amsterdam. */
export function businessDate(
  testMode: boolean,
  testDate: string | null | undefined,
  instant: Date = new Date(),
): string {
  if (testMode && testDate && /^\d{4}-\d{2}-\d{2}/.test(testDate)) return testDate.slice(0, 10);
  return amsterdamCalendar(instant).date;
}

/** Noon in Amsterdam on a calendar date, so the date does not slip to the previous UTC day. */
export function businessInstant(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return amsterdamInstant(year, month, day, 12, 0);
}

export function addBusinessDays(date: string, days: number): string {
  return addCalendarDays(date, days);
}

export function businessMonth(date: string): { yearMonth: string; start: string; end: string } {
  const yearMonth = date.slice(0, 7);
  const [, monthText] = yearMonth.split('-');
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(monthText);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    yearMonth,
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** Start and end instants of the Amsterdam month that contains `date`, as ISO timestamps. */
export function businessMonthRange(date: string): { start: string; end: string } {
  const [year, month] = businessMonth(date).yearMonth.split('-').map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const start = amsterdamInstant(year, month, 1, 0, 0);
  const end = new Date(amsterdamInstant(nextYear, nextMonth, 1, 0, 0).getTime() - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
