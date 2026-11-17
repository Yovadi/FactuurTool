import { addCalendarDays, amsterdamCalendar, amsterdamNextMonthStart } from './amsterdamCalendar';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const lateNovember = new Date('2026-11-30T23:30:00Z');
const november = amsterdamCalendar(lateNovember);
assert(november.yearMonth === '2026-12', `23:30 UTC on 30 Nov is 1 Dec in Amsterdam, got ${november.yearMonth}`);
assert(november.date === '2026-12-01', `Amsterdam date, got ${november.date}`);

const stillNovember = amsterdamCalendar(new Date('2026-11-30T22:30:00Z'));
assert(stillNovember.yearMonth === '2026-11', `22:30 UTC on 30 Nov is still November in Amsterdam, got ${stillNovember.yearMonth}`);

const next = amsterdamNextMonthStart(lateNovember);
assert(next.toISOString() === '2026-12-31T23:15:00.000Z', `next month start, got ${next.toISOString()}`);

assert(addCalendarDays('2026-12-01', 14) === '2026-12-15', 'due date stays on the calendar');

console.log('amsterdam calendar tests passed');
