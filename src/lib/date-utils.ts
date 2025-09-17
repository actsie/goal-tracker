import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { settingsService } from './settingsService';

export function formatDateKey(date: Date, timezone?: string): string {
  if (timezone) {
    return settingsService.formatDateInTimezone(date, timezone);
  }
  return format(date, 'yyyy-MM-dd');
}

export function parseeDateKey(dateKey: string): Date {
  return new Date(dateKey);
}

export async function getMonthCalendarDays(date: Date): Promise<Date[]> {
  const settings = await settingsService.getSettings();
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: settings.weekStartDay });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: settings.weekStartDay });
  
  return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
}

export function isCurrentMonth(date: Date, referenceDate: Date): boolean {
  return isSameMonth(date, referenceDate);
}

export async function isToday(date: Date): Promise<boolean> {
  const settings = await settingsService.getSettings();
  const todayInTimezone = settingsService.formatDateInTimezone(new Date(), settings.timezone);
  const dateInTimezone = settingsService.formatDateInTimezone(date, settings.timezone);
  return todayInTimezone === dateInTimezone;
}

export function getNextMonth(date: Date): Date {
  return addMonths(date, 1);
}

export function getPreviousMonth(date: Date): Date {
  return subMonths(date, 1);
}

export function getMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy');
}

export function getDayOfMonth(date: Date): number {
  return date.getDate();
}

export async function getWeekdayNames(): Promise<string[]> {
  const settings = await settingsService.getSettings();
  const baseNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  if (settings.weekStartDay === 1) {
    // Start with Monday
    return [...baseNames.slice(1), baseNames[0]];
  }
  
  return baseNames;
}

// New timezone-aware utilities
export async function formatDateKeyWithTimezone(date: Date): Promise<string> {
  const settings = await settingsService.getSettings();
  return settingsService.formatDateInTimezone(date, settings.timezone);
}

export async function getCurrentDateInTimezone(): Promise<Date> {
  const settings = await settingsService.getSettings();
  const now = new Date();
  const tzDateStr = settingsService.formatDateInTimezone(now, settings.timezone);
  return new Date(tzDateStr);
}

export async function getStartOfDayInUserTimezone(date: Date): Promise<Date> {
  const settings = await settingsService.getSettings();
  return settingsService.getStartOfDayInTimezone(date, settings.timezone);
}

export async function getEndOfDayInUserTimezone(date: Date): Promise<Date> {
  const settings = await settingsService.getSettings();
  return settingsService.getEndOfDayInTimezone(date, settings.timezone);
}