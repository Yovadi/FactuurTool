import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type InlineDatePickerProps = {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
};

export function InlineDatePicker({ value, onChange, minDate }: InlineDatePickerProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    return value ? new Date(value + 'T00:00:00') : new Date();
  });

  const monthNames = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ];

  const dayNames = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days: (number | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = selectedDate.toISOString().split('T')[0];

    if (minDate && dateStr < minDate) {
      return;
    }

    onChange(dateStr);
  };

  const handleToday = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setCurrentDate(today);
    onChange(todayStr);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const selectedDate = new Date(value + 'T00:00:00');
    return (
      day === selectedDate.getDate() &&
      currentDate.getMonth() === selectedDate.getMonth() &&
      currentDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isPastDate = (day: number) => {
    if (!minDate) return false;
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString().split('T')[0];
    return dateStr < minDate;
  };

  const days = getDaysInMonth(currentDate);

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg p-4 inline-block">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-gray-200">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePreviousMonth}
            className="p-1 hover:bg-dark-700 rounded transition-colors text-gray-300"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 hover:bg-dark-700 rounded transition-colors text-gray-300"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-xs font-medium text-gray-400 text-center py-1"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <button
            key={index}
            type="button"
            onClick={() => day && handleDateClick(day)}
            disabled={!day || isPastDate(day)}
            className={`
              aspect-square flex items-center justify-center text-sm rounded transition-colors
              ${!day ? 'invisible' : ''}
              ${isPastDate(day) ? 'text-gray-600 cursor-not-allowed' : ''}
              ${isSelected(day) ? 'bg-blue-600 text-white font-bold' : ''}
              ${isToday(day) && !isSelected(day) ? 'bg-dark-700 text-gray-200 ring-1 ring-gold-500' : ''}
              ${!isSelected(day) && !isToday(day) && !isPastDate(day) ? 'text-gray-300 hover:bg-dark-700' : ''}
            `}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="flex justify-between mt-4 pt-3 border-t border-dark-600">
        <button
          type="button"
          onClick={handleToday}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Vandaag
        </button>
      </div>
    </div>
  );
}
