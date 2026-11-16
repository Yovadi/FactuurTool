/** Calendar dates in Europe/Amsterdam, independent of the machine timezone. */

const TIME_ZONE = 'Europe/Amsterdam';

export type AmsterdamCalendar = {
  year: number;
  month: number;
  day: number;
  yearMonth: string;
  date: string;
};

export function amsterdamCalendar(instant: Date = new Date()): AmsterdamCalendar {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const year = Number(value('year'));
  const month = Number(value('month'));
  const day = Number(value('day'));
  return {
    year,
    month,
    day,
    yearMonth: `${value('year')}-${value('month')}`,
    date: `${value('year')}-${value('month')}-${value('day')}`,
  };
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** UTC instant for a clock time in Europe/Amsterdam. */
export function amsterdamInstant(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(guess);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');
  const hourValue = value('hour') % 24;
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), hourValue, value('minute'), value('second'));
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

/** 00:15 on the first day of the next Amsterdam month, as a UTC instant. */
export function amsterdamNextMonthStart(instant: Date = new Date()): Date {
  const { year, month } = amsterdamCalendar(instant);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return amsterdamInstant(nextYear, nextMonth, 1, 0, 15);
}
