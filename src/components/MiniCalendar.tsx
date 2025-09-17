import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  formatDateKey,
  formatDateKeyWithTimezone,
  getMonthCalendarDays,
  isCurrentMonth,
  getNextMonth,
  getPreviousMonth,
  getMonthYear,
  getDayOfMonth,
  getWeekdayNames
} from '@/lib/date-utils';
import { hasDataForDate, getCompletionPercentage } from '@/lib/db';

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  className?: string;
}

interface DateInfo {
  date: Date;
  hasData: boolean;
  completionPercentage: number;
}

export function MiniCalendar({ selectedDate, onDateSelect, className }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const [dateInfos, setDateInfos] = useState<Map<string, DateInfo>>(new Map());
  const [focusedDate, setFocusedDate] = useState<Date | null>(selectedDate);
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load calendar configuration
  useEffect(() => {
    const loadCalendarConfig = async () => {
      try {
        setIsLoading(true);
        const [days, dayNames] = await Promise.all([
          getMonthCalendarDays(currentMonth),
          getWeekdayNames()
        ]);
        setCalendarDays(days);
        setWeekdays(dayNames);
      } catch (error) {
        console.error('Error loading calendar config:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCalendarConfig();
  }, [currentMonth]);

  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = async () => {
      const [days, dayNames] = await Promise.all([
        getMonthCalendarDays(currentMonth),
        getWeekdayNames()
      ]);
      setCalendarDays(days);
      setWeekdays(dayNames);
    };

    window.addEventListener('settingsChanged', handleSettingsChange);
    return () => window.removeEventListener('settingsChanged', handleSettingsChange);
  }, [currentMonth]);

  // Load date info for all visible days
  const loadDateInfos = useCallback(async () => {
    if (calendarDays.length === 0) return;
    
    const newDateInfos = new Map<string, DateInfo>();
    
    for (const date of calendarDays) {
      try {
        const dateKey = await formatDateKeyWithTimezone(date);
        const hasData = await hasDataForDate(dateKey);
        const completionPercentage = hasData ? await getCompletionPercentage(dateKey) : 0;
        
        newDateInfos.set(dateKey, {
          date,
          hasData,
          completionPercentage
        });
      } catch (error) {
        console.error('Error loading date info for', date, error);
        // Fallback to local date key
        const dateKey = formatDateKey(date);
        const hasData = await hasDataForDate(dateKey);
        const completionPercentage = hasData ? await getCompletionPercentage(dateKey) : 0;
        
        newDateInfos.set(dateKey, {
          date,
          hasData,
          completionPercentage
        });
      }
    }
    
    setDateInfos(newDateInfos);
  }, [calendarDays]);

  useEffect(() => {
    loadDateInfos();
  }, [loadDateInfos]);

  // Listen for data changes to refresh calendar indicators
  useEffect(() => {
    const handleDataChange = () => {
      loadDateInfos();
    };
    
    window.addEventListener('dayDataChanged', handleDataChange);
    return () => window.removeEventListener('dayDataChanged', handleDataChange);
  }, [loadDateInfos]);

  const handleDateClick = (date: Date) => {
    setFocusedDate(date);
    onDateSelect(date);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!focusedDate) return;

    const currentIndex = calendarDays.findIndex(date => 
      formatDateKey(date) === formatDateKey(focusedDate)
    );

    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        newIndex = Math.min(calendarDays.length - 1, currentIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        newIndex = Math.max(0, currentIndex - 7);
        break;
      case 'ArrowDown':
        event.preventDefault();
        newIndex = Math.min(calendarDays.length - 1, currentIndex + 7);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onDateSelect(focusedDate);
        return;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = calendarDays.length - 1;
        break;
      case 'PageUp':
        event.preventDefault();
        setCurrentMonth(getPreviousMonth(currentMonth));
        return;
      case 'PageDown':
        event.preventDefault();
        setCurrentMonth(getNextMonth(currentMonth));
        return;
      default:
        return;
    }

    const newDate = calendarDays[newIndex];
    if (newDate) {
      setFocusedDate(newDate);
      // Change month if needed
      if (!isCurrentMonth(newDate, currentMonth)) {
        setCurrentMonth(newDate);
      }
    }
  };

  const previousMonth = () => {
    setCurrentMonth(getPreviousMonth(currentMonth));
  };

  const nextMonth = () => {
    setCurrentMonth(getNextMonth(currentMonth));
  };

  return (
    <div className={cn("bg-card border rounded-lg p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={previousMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold">{getMonthYear(currentMonth)}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div 
        className="grid grid-cols-7 gap-1"
        role="grid"
        aria-label={`Calendar for ${getMonthYear(currentMonth)}`}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Weekday headers */}
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-xs text-muted-foreground text-center p-1 font-medium"
            role="columnheader"
          >
            {day}
          </div>
        ))}
        
        {/* Loading state */}
        {isLoading && (
          <div className="col-span-7 flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Calendar days */}
        {calendarDays.map((date) => {
          const dateKey = formatDateKey(date); // Use sync version for map key
          const dateInfo = dateInfos.get(dateKey);
          const isSelected = formatDateKey(date) === formatDateKey(selectedDate);
          const isFocused = focusedDate && formatDateKey(date) === formatDateKey(focusedDate);
          const isCurrentMonthDay = isCurrentMonth(date, currentMonth);
          // Note: isToday will be handled in a useEffect since it's async

          return (
            <button
              key={dateKey}
              onClick={() => handleDateClick(date)}
              className={cn(
                "relative w-8 h-8 text-xs rounded-md transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                {
                  "text-muted-foreground": !isCurrentMonthDay,
                  "bg-primary text-primary-foreground": isSelected,
                  "bg-accent": isFocused && !isSelected,
                  "ring-2 ring-primary": isFocused,
                }
              )}
              role="gridcell"
              aria-label={`${formatDateKey(date)}${dateInfo?.hasData ? `, has ${dateInfo.completionPercentage}% completion` : ''}`}
              aria-selected={isSelected}
              tabIndex={isFocused ? 0 : -1}
            >
              {getDayOfMonth(date)}
              
              {/* Data indicator dot */}
              {dateInfo?.hasData && (
                <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2">
                  <div className="w-1 h-1 bg-current rounded-full opacity-60" />
                </div>
              )}
              
              {/* Completion indicator */}
              {dateInfo?.hasData && dateInfo.completionPercentage > 0 && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-current opacity-40 rounded-b-md"
                  style={{ 
                    width: `${dateInfo.completionPercentage}%`,
                    marginLeft: `${(100 - dateInfo.completionPercentage) / 2}%`
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}